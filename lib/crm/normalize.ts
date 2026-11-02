/**
 * Normalización de nombres, mails, teléfonos y CUIT para matchear empresas
 * que llegan escritas de distintas formas ("LENOVO ARGENTINA S.R.L.", "Lenovo", "lenevo").
 * Funciones puras (sin dependencias del servidor) para poder testearlas.
 */

/** Sufijos societarios y palabras que no identifican a la empresa. */
const LEGAL_TOKENS = new Set([
  'sa', 'srl', 'sas', 'saic', 'saci', 'sacif', 'sacifi', 'sacifia', 'saica', 'sca', 'scs', 'se', 'sh',
  'ltda', 'inc', 'llc', 'ltd', 'corp', 'co', 'cia', 'gmbh', 'bv', 'spa',
  'sociedad', 'anonima', 'responsabilidad', 'limitada', 'comercial', 'industrial',
])
/** Se sacan sólo si queda algo más (ej. "Lenovo Argentina" → "lenovo", pero "Argentina" queda). */
const SOFT_TOKENS = new Set(['argentina', 'arg', 'grupo', 'group', 'la', 'el', 'los', 'las', 'de', 'del', 'y'])

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** "Lenovo Argentina S.R.L." → "lenovo". Vacío si no queda nada útil. */
export function normalizeCompanyName(raw: string | null | undefined): string {
  if (!raw) return ''
  let s = stripAccents(raw).toLowerCase()
  s = s.replace(/&/g, ' y ')
  // "S.A." → "sa", "S. R. L." → "s r l" (se unen abajo)
  s = s.replace(/\.(?=\S)/g, '').replace(/[.,;:'"`´()\[\]{}\/\\|_+*!?¡¿#@-]/g, ' ')
  let tokens = s.split(/\s+/).filter(Boolean)
  // Unir secuencias de letras sueltas: "s r l" → "srl"
  const joined: string[] = []
  let buf = ''
  for (const t of tokens) {
    if (t.length === 1 && /[a-z]/.test(t)) {
      buf += t
      continue
    }
    if (buf) { joined.push(buf); buf = '' }
    joined.push(t)
  }
  if (buf) joined.push(buf)
  tokens = joined.filter((t) => !LEGAL_TOKENS.has(t))
  const core = tokens.filter((t) => !SOFT_TOKENS.has(t))
  if (core.length > 0) tokens = core
  return tokens.join(' ').trim()
}

/** Dominios de correo genéricos: no identifican a una empresa. */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'hotmail.com.ar', 'outlook.com', 'outlook.com.ar', 'live.com', 'live.com.ar',
  'yahoo.com', 'yahoo.com.ar', 'icloud.com', 'me.com', 'msn.com', 'aol.com', 'protonmail.com', 'proton.me',
  'fibertel.com.ar', 'arnet.com.ar', 'speedy.com.ar', 'ciudad.com.ar', 'gmx.com', 'mail.com',
])

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null
}

/** Dominio corporativo del mail, o null si es gmail/hotmail/etc. */
export function companyDomainFromEmail(raw: string | null | undefined): string | null {
  const email = normalizeEmail(raw)
  if (!email) return null
  const domain = email.split('@')[1]
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) return null
  return domain
}

/** "www.Lenovo.com.ar/contacto" → "lenovo.com.ar" */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null
  let s = raw.trim().toLowerCase()
  if (s.includes('@')) return companyDomainFromEmail(s)
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : null
}

/** "lenovo.com.ar" → "Lenovo" (para sugerir nombre de empresa nueva). */
export function companyNameFromDomain(domain: string): string {
  const label = domain.split('.')[0].replace(/[-_]+/g, ' ')
  return label.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Teléfono argentino a una forma comparable: código de área + número, sin 54, 9, 0 ni 15.
 * "+54 9 3329 64-3639" y "03329 15 643639" → "3329643639".
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/\D/g, '')
  if (d.length < 6) return null
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('54') && d.length >= 12) d = d.slice(2)
  if (d.startsWith('9') && d.length === 11) d = d.slice(1)
  if (d.startsWith('0')) d = d.slice(1)
  // "3329 15 643639" (área de 4 + 15 + 6) → quitar el 15
  if (d.length === 12) {
    for (const areaLen of [2, 3, 4]) {
      if (d.slice(areaLen, areaLen + 2) === '15') {
        d = d.slice(0, areaLen) + d.slice(areaLen + 2)
        break
      }
    }
  }
  return d.length >= 8 ? d : null
}

/** CUIT con dígito verificador válido → "30123456789" (sólo dígitos), o null. */
export function normalizeCuit(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  if (d.length !== 11) return null
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0)
  let check = 11 - (sum % 11)
  if (check === 11) check = 0
  if (check === 10) return null
  return check === Number(d[10]) ? d : null
}

export function formatCuit(cuit: string | null | undefined): string {
  if (!cuit) return ''
  const d = cuit.replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : cuit
}

/** Nombre "lindo" para mostrar: respeta lo que escribió, recorta espacios. */
export function cleanDisplayName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}
