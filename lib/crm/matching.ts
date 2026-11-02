/**
 * Sugerencia de empresa para un pedido entrante.
 *
 * Señales (de más fuerte a más débil):
 *   CUIT igual · alias exacto · nombre normalizado igual · dominio del mail ·
 *   teléfono o mail de un contacto conocido · nombre parecido (Lenevo ≈ Lenovo).
 *
 * Funciones puras: reciben el catálogo y devuelven candidatos ordenados con el motivo.
 */
import {
  companyDomainFromEmail,
  normalizeCompanyName,
  normalizeCuit,
  normalizeEmail,
  normalizePhone,
} from './normalize'

export type MatchCatalog = {
  companies: { id: string; name: string; nameNorm: string; cuit: string | null; emailDomain: string | null }[]
  aliases: { companyId: string; alias: string; aliasNorm: string }[]
  contacts: { companyId: string; email: string | null; phoneNorm: string | null }[]
}

export type MatchInput = {
  companyName?: string | null
  cuit?: string | null
  emails?: (string | null | undefined)[]
  phones?: (string | null | undefined)[]
}

export type MatchReason =
  | { kind: 'cuit' }
  | { kind: 'alias'; alias: string }
  | { kind: 'name' }
  | { kind: 'domain'; domain: string }
  | { kind: 'contact_email'; email: string }
  | { kind: 'contact_phone' }
  | { kind: 'similar'; written: string; similarity: number }

export type MatchCandidate = {
  companyId: string
  companyName: string
  score: number
  reasons: MatchReason[]
}

/** A partir de este score se preselecciona la empresa en la Bandeja. */
export const STRONG_MATCH = 0.9
/** Debajo de esto no se muestra como posible. */
export const MIN_SUGGESTION = 0.72

// ---------------------------------------------------------------------------
// Similitud de texto
// ---------------------------------------------------------------------------

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const aM = new Array<boolean>(a.length).fill(false)
  const bM = new Array<boolean>(b.length).fill(false)
  let matches = 0
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - range)
    const hi = Math.min(i + range + 1, b.length)
    for (let j = lo; j < hi; j++) {
      if (bM[j] || a[i] !== b[j]) continue
      aM[i] = bM[j] = true
      matches++
      break
    }
  }
  if (!matches) return 0
  let t = 0
  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aM[i]) continue
    while (!bM[k]) k++
    if (a[i] !== b[k]) t++
    k++
  }
  const m = matches
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3
  let prefix = 0
  for (let i = 0; i < Math.min(4, a.length, b.length) && a[i] === b[i]; i++) prefix++
  return jaro + prefix * 0.1 * (1 - jaro)
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

function levRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max
}

/**
 * Similitud entre dos nombres YA normalizados (0..1).
 * Combina Jaro-Winkler, Levenshtein sin espacios ("mercadolibre" = "mercado libre")
 * y coincidencia de palabras en cualquier orden.
 */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const ca = a.replace(/\s+/g, '')
  const cb = b.replace(/\s+/g, '')
  if (ca === cb) return 0.98
  // Nombres muy cortos (siglas): sólo valen iguales.
  if (Math.min(ca.length, cb.length) <= 3) return 0
  const jw = jaroWinkler(ca, cb)
  const lev = levRatio(ca, cb)
  const ta = a.split(' ').sort().join(' ')
  const tb = b.split(' ').sort().join(' ')
  const tokenSorted = levRatio(ta, tb)
  // Una palabra contenida en la otra ("arcor" vs "arcor alimentos"): parecido pero no igual
  const wa = new Set(a.split(' '))
  const wb = new Set(b.split(' '))
  const inter = [...wa].filter((w) => wb.has(w) && w.length >= 4).length
  const containment = inter > 0 ? 0.8 + 0.1 * (inter / Math.min(wa.size, wb.size)) : 0
  // Promedio JW/Lev castiga menos las letras cambiadas que los nombres distintos.
  return Math.min(0.97, Math.max((jw + lev) / 2, tokenSorted, containment))
}

// ---------------------------------------------------------------------------
// Candidatos
// ---------------------------------------------------------------------------

const REASON_SCORE: Record<MatchReason['kind'], number> = {
  cuit: 1,
  alias: 0.99,
  name: 0.99,
  domain: 0.96,
  contact_email: 0.97,
  contact_phone: 0.93,
  similar: 0, // usa la similitud
}

export function findCompanyCandidates(input: MatchInput, catalog: MatchCatalog, limit = 5): MatchCandidate[] {
  const byId = new Map<string, MatchCandidate>()
  const nameById = new Map(catalog.companies.map((c) => [c.id, c.name]))

  const add = (companyId: string, reason: MatchReason, score: number) => {
    const name = nameById.get(companyId)
    if (!name) return
    const cur = byId.get(companyId) ?? { companyId, companyName: name, score: 0, reasons: [] }
    if (!cur.reasons.some((r) => r.kind === reason.kind)) cur.reasons.push(reason)
    // Dos señales fuertes distintas suben un poco la confianza
    cur.score = cur.score > 0 ? Math.min(1, Math.max(cur.score, score) + 0.01) : score
    byId.set(companyId, cur)
  }

  const cuit = normalizeCuit(input.cuit)
  if (cuit) {
    for (const c of catalog.companies) if (c.cuit === cuit) add(c.id, { kind: 'cuit' }, REASON_SCORE.cuit)
  }

  const emails = (input.emails ?? []).map(normalizeEmail).filter((e): e is string => !!e)
  for (const email of emails) {
    const domain = companyDomainFromEmail(email)
    if (domain) {
      for (const c of catalog.companies) {
        if (c.emailDomain && (c.emailDomain === domain || domain.endsWith(`.${c.emailDomain}`))) {
          add(c.id, { kind: 'domain', domain }, REASON_SCORE.domain)
        }
      }
    }
    for (const ct of catalog.contacts) {
      if (ct.email && ct.email.toLowerCase() === email) add(ct.companyId, { kind: 'contact_email', email }, REASON_SCORE.contact_email)
    }
  }

  const phones = (input.phones ?? []).map(normalizePhone).filter((p): p is string => !!p)
  for (const phone of phones) {
    for (const ct of catalog.contacts) {
      if (ct.phoneNorm && ct.phoneNorm === phone) add(ct.companyId, { kind: 'contact_phone' }, REASON_SCORE.contact_phone)
    }
  }

  const written = input.companyName?.trim()
  const norm = normalizeCompanyName(written)
  if (norm) {
    for (const c of catalog.companies) {
      if (c.nameNorm === norm) { add(c.id, { kind: 'name' }, REASON_SCORE.name); continue }
      const sim = nameSimilarity(norm, c.nameNorm)
      if (sim >= MIN_SUGGESTION) add(c.id, { kind: 'similar', written: written!, similarity: sim }, sim)
    }
    for (const a of catalog.aliases) {
      if (a.aliasNorm === norm) { add(a.companyId, { kind: 'alias', alias: a.alias }, REASON_SCORE.alias); continue }
      const sim = nameSimilarity(norm, a.aliasNorm)
      if (sim >= MIN_SUGGESTION) add(a.companyId, { kind: 'similar', written: written!, similarity: sim }, sim * 0.98)
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.companyName.localeCompare(b.companyName))
    .slice(0, limit)
}

/** Pares de empresas que probablemente sean la misma (para ofrecer fusionarlas). */
export function findDuplicateCompanies(
  companies: MatchCatalog['companies'],
  threshold = 0.84,
): { a: string; b: string; similarity: number }[] {
  const out: { a: string; b: string; similarity: number }[] = []
  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const x = companies[i]
      const y = companies[j]
      let sim = nameSimilarity(x.nameNorm, y.nameNorm)
      if (x.cuit && y.cuit && x.cuit === y.cuit) sim = 1
      if (x.emailDomain && y.emailDomain && x.emailDomain === y.emailDomain) sim = Math.max(sim, 0.95)
      if (sim >= threshold) out.push({ a: x.id, b: y.id, similarity: sim })
    }
  }
  return out.sort((p, q) => q.similarity - p.similarity)
}

export function describeReason(r: MatchReason): string {
  switch (r.kind) {
    case 'cuit': return 'Mismo CUIT'
    case 'alias': return `Alias conocido "${r.alias}"`
    case 'name': return 'Mismo nombre'
    case 'domain': return `Mail @${r.domain}`
    case 'contact_email': return `Contacto ${r.email}`
    case 'contact_phone': return 'Teléfono de un contacto'
    case 'similar': return `Nombre parecido (${Math.round(r.similarity * 100)}%)`
  }
}
