/**
 * Lectura heurística de un pedido de cotización escrito a mano
 * (WhatsApp pegado, mail, nota de un llamado). Extrae lo que puede; lo demás
 * se completa en la Bandeja. Funciones puras.
 */
import { PALLETS_PER_SEMI } from './constants'
import {
  companyDomainFromEmail,
  companyNameFromDomain,
  normalizeCuit,
  normalizeEmail,
  normalizePhone,
  stripAccents,
} from './normalize'
import { findPlaces, type PlaceHit } from './places'
import type { CrmFrequency, CrmServiceType, ParsedRequest } from './types'

// "[2/11/26, 10:15:32] Juan Pérez: hola" · "2/11/26 10:15 - Juan Pérez: hola"
const WA_LINE = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?([^:\n]{1,60}):\s?/gim

/** Saca los encabezados de un chat exportado/pegado de WhatsApp y devuelve el remitente. */
export function stripWhatsAppHeaders(text: string): { text: string; sender?: string } {
  let sender: string | undefined
  const cleaned = text.replace(WA_LINE, (_m, _date, name: string) => {
    if (!sender) sender = name.trim()
    return ''
  })
  return { text: cleaned, sender }
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

export function extractEmails(text: string): string[] {
  const found = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []
  return uniq(found.map((e) => normalizeEmail(e)).filter((e): e is string => !!e))
}

export function extractCuit(text: string): string | undefined {
  const re = /\b(\d{2})[-\s.]?(\d{8})[-\s.]?(\d)\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const c = normalizeCuit(m[0])
    if (c) return c
  }
  return undefined
}

export function extractPhones(text: string): string[] {
  const out: string[] = []
  const re = /\+?\d[\d\s().-]{7,20}\d/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const raw = m[0]
    const digits = raw.replace(/\D/g, '')
    if (normalizeCuit(digits)) continue
    if (/^\d{1,2}[.-]\d{1,2}[.-]\d{2,4}$/.test(raw.trim())) continue
    const p = normalizePhone(raw)
    if (p && p.length === 10) out.push(raw.trim())
  }
  return uniq(out)
}

function parseNumberEs(raw: string): number {
  // "1.500" → 1500 · "1,5" → 1.5 · "2.5" → 2.5
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) return Number(raw.replace(/\./g, '').replace(',', '.'))
  return Number(raw.replace(',', '.'))
}

export function extractPallets(norm: string): { pallets?: number; full?: boolean } {
  const full = /\b(semi\s+completo|carga\s+completa|camion\s+completo|equipo\s+completo|full\s+truck|semi\s+entero|un\s+semi|1\s+semi)\b/.test(norm)
  const m = norm.match(/\b(\d{1,3})\s*(?:pallets?|palets?|palles|paletas?|posiciones|pos\.)(?![a-z])/)
  const pallets = m ? Number(m[1]) : undefined
  return { pallets: pallets && pallets > 0 ? pallets : undefined, full: full || undefined }
}

export function extractWeightKg(norm: string): number | undefined {
  const m = norm.match(/\b(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(kg|kgs|kilos?|tn|tns|toneladas?)(?![a-z])/)
  if (!m) return undefined
  const n = parseNumberEs(m[1])
  if (!Number.isFinite(n) || n <= 0) return undefined
  return /^t/.test(m[2]) ? Math.round(n * 1000) : Math.round(n)
}

export function extractService(norm: string): CrmServiceType | undefined {
  if (/congelad|freezer|ultracongelad|[-−]\s?(18|20|25)\s*(°|grados|c\b)/.test(norm)) return 'congelado'
  if (/temperatura\s+controlada|temp\.?\s+controlada/.test(norm)) return 'controlada'
  if (/refrigerad|refrigeracion|cadena\s+de\s+frio|\bfrio\b|\b[0-8]\s*(°|grados)|lacteo|fiambre/.test(norm)) return 'refrigerado'
  if (/\bseco\b|carga\s+seca|temperatura\s+ambiente/.test(norm)) return 'seco'
  return undefined
}

export function extractFrequency(norm: string): CrmFrequency | undefined {
  if (/semanal|todas\s+las\s+semanas|cada\s+semana|por\s+semana|\bx\s*semana/.test(norm)) return 'semanal'
  if (/quincenal|cada\s+15\s+dias|cada\s+quince/.test(norm)) return 'quincenal'
  if (/mensual|todos\s+los\s+meses|por\s+mes|cada\s+mes/.test(norm)) return 'mensual'
  if (/unica\s+vez|por\s+unica|puntual|\bspot\b|un\s+solo\s+viaje/.test(norm)) return 'unica'
  return undefined
}

/** dd/mm[/aa] → ISO. Si no trae año, el próximo que no haya pasado hace más de 30 días. */
export function extractDate(norm: string, ref: Date): string | undefined {
  const re = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(norm))) {
    const d = Number(m[1])
    const mo = Number(m[2])
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue
    let y = m[3] ? Number(m[3]) : ref.getFullYear()
    if (y < 100) y += 2000
    if (!m[3]) {
      const candidate = Date.UTC(y, mo - 1, d)
      const refUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate())
      if (candidate < refUtc - 30 * 86400000) y += 1
    }
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  if (/\bpasado\s+manana\b/.test(norm)) return isoPlus(ref, 2)
  if (/\bmanana\b/.test(norm)) return isoPlus(ref, 1)
  if (/\bhoy\b/.test(norm)) return isoPlus(ref, 0)
  return undefined
}

function isoPlus(ref: Date, days: number): string {
  const d = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate() + days))
  return d.toISOString().slice(0, 10)
}

const ORIGIN_BEFORE = /(?:desde|origen\s*:?|sale\s+de|salida\s+de|carga\s+en|cargamos\s+en|cargar\s+en|retiro\s+en|retirar\s+en|\bde)\s*(?:la\s+ciudad\s+de\s+|el\s+|la\s+)?$/
const DEST_BEFORE = /(?:\ba|hasta|para|destino\s*:?|hacia|entrega\s+en|entregar\s+en|descarga\s+en|con\s+destino\s+a?|llevar\s+a|enviar\s+a|mandar\s+a|\ben)\s*(?:la\s+ciudad\s+de\s+|el\s+|la\s+)?$/

export function extractRoute(norm: string): Pick<ParsedRequest, 'origin' | 'originProvince' | 'destination' | 'destinationProvince'> {
  const hits = findPlaces(norm)
  if (!hits.length) return {}
  let origin: PlaceHit | undefined
  let dest: PlaceHit | undefined
  for (const h of hits) {
    const before = norm.slice(Math.max(0, h.index - 28), h.index)
    if (!origin && ORIGIN_BEFORE.test(before) && !/\ben\s*$/.test(before)) origin = h
    else if (!dest && DEST_BEFORE.test(before)) dest = h
  }
  const isBA = (h: PlaceHit) => h.province === 'Buenos Aires' || h.province === 'CABA'
  if (!dest) dest = hits.find((h) => h !== origin && !isBA(h)) ?? hits.find((h) => h !== origin && origin && h.province !== origin.province)
  if (!origin) origin = hits.find((h) => h !== dest && isBA(h))
  if (origin && dest && origin === dest) origin = undefined
  return {
    origin: origin?.name,
    originProvince: origin?.province,
    destination: dest?.name,
    destinationProvince: dest?.province,
  }
}

const NAME_WORD = "[A-ZÁÉÍÓÚÑ][a-záéíóúñ']+"

export function extractSenderName(text: string): string | undefined {
  const m = text.match(new RegExp(`(?:\\bsoy|mi nombre es|me llamo|habla)\\s+(${NAME_WORD}(?:\\s+${NAME_WORD})?)`, 'i'))
  if (m && /^[A-ZÁÉÍÓÚÑ]/.test(m[1])) return m[1]
  const sig = text.match(new RegExp(`(?:saludos|atte\\.?|atentamente|muchas gracias|gracias|cordialmente)[,.!]?\\s*\\n+\\s*(${NAME_WORD}(?:\\s+${NAME_WORD}){1,2})\\s*(?:\\n|$)`, 'i'))
  return sig?.[1]
}

const LEGAL_SUFFIX = /\b(S\.?\s?A\.?|S\.?\s?R\.?\s?L\.?|S\.?\s?A\.?\s?S\.?|S\.?A\.?I\.?C\.?|S\.?A\.?C\.?I\.?F\.?)(?=\s|$|[,.;])/

export function extractCompanyName(text: string, emails: string[]): string | undefined {
  const label = text.match(/(?:empresa|raz[oó]n\s+social|compa[nñ][ií]a|cliente)\s*[:\-]\s*([^\n,;]{2,60})/i)
  if (label) return label[1].trim()

  const intro = text.match(/(?:les?\s+escribo\s+de|te\s+escribo\s+de|nos\s+comunicamos\s+de|me\s+comunico\s+de|escribo\s+de(?:sde)?|de\s+parte\s+de|somos(?:\s+de)?|trabajo\s+en|soy\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?\s+de)\s+(?:la\s+empresa\s+|la\s+firma\s+)?([A-Z0-9][\wÁÉÍÓÚÑáéíóúñ&.\- ]{1,40}?)(?=[,.;:\n!?]|\s+(?:y|para|necesit|quer|quisi|les|te|nos|estamos|tenemos)\b|$)/)
  if (intro) {
    const candidate = intro[1].trim()
    const isPlace = findPlaces(stripAccents(candidate).toLowerCase()).some((h) => h.index === 0)
    if (!isPlace) return candidate
  }

  for (const line of text.split('\n')) {
    const l = line.trim()
    if (l.length > 2 && l.length < 60 && LEGAL_SUFFIX.test(l)) return l.replace(/^[-–•*]\s*/, '')
  }

  for (const e of emails) {
    const d = companyDomainFromEmail(e)
    if (d) return companyNameFromDomain(d)
  }
  return undefined
}

/** Punto de entrada: texto libre → campos. `ref` es la fecha de recepción (para fechas sin año). */
export function parseRequestText(raw: string, ref: Date = new Date()): ParsedRequest {
  const { text, sender } = stripWhatsAppHeaders(raw.normalize('NFC'))
  const norm = stripAccents(text).toLowerCase()
  const emails = extractEmails(text)
  const phones = extractPhones(text)
  const { pallets, full } = extractPallets(norm)
  const out: ParsedRequest = {
    senderName: extractSenderName(text) ?? sender,
    companyName: extractCompanyName(text, emails),
    emails: emails.length ? emails : undefined,
    phones: phones.length ? phones : undefined,
    cuit: extractCuit(text),
    ...extractRoute(norm),
    pallets: pallets ?? (full ? PALLETS_PER_SEMI : undefined),
    weightKg: extractWeightKg(norm),
    serviceType: extractService(norm),
    loadDate: extractDate(norm, ref),
    frequency: extractFrequency(norm),
  }
  const p = out.pallets
  if (full || (p && p >= PALLETS_PER_SEMI)) out.loadType = 'completa'
  else if (p) out.loadType = 'parcial'
  // Sacar claves vacías para que el JSON quede limpio
  for (const k of Object.keys(out) as (keyof ParsedRequest)[]) if (out[k] === undefined) delete out[k]
  return out
}
