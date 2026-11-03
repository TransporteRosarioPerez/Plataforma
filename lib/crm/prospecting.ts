/**
 * Prospección por mail (cargas de vuelta). Lógica pura: plantillas, CSV,
 * clasificación de respuestas, armado del mail (MIME) y horarios de envío.
 * La usan las acciones, el job y los tests.
 */
import { normalizeCompanyName, normalizeEmail, stripAccents } from './normalize'

export type ProspectStatus =
  | 'nuevo' | 'en_secuencia' | 'respondio' | 'cotizando' | 'ganado' | 'perdido' | 'sin_respuesta' | 'baja' | 'rebotado'
export type OutreachStatus = 'activa' | 'pausada' | 'respondida' | 'terminada' | 'cancelada' | 'rebotada' | 'baja' | 'error'
export type ProspectPriority = 'alta' | 'media' | 'baja'

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  nuevo: 'Sin contactar',
  en_secuencia: 'En secuencia',
  respondio: 'Respondió',
  cotizando: 'Cotizando',
  ganado: 'Ganado',
  perdido: 'Perdido',
  sin_respuesta: 'Sin respuesta',
  baja: 'Pidió baja',
  rebotado: 'Rebotó',
}

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  activa: 'Activa',
  pausada: 'Pausada',
  respondida: 'Respondida',
  terminada: 'Terminada',
  cancelada: 'Cancelada',
  rebotada: 'Rebotada',
  baja: 'Baja',
  error: 'Error',
}

export const PRIORITY_LABELS: Record<ProspectPriority, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

/** Estados en los que no se puede iniciar una secuencia. */
export const BLOCKED_STATUSES: ProspectStatus[] = ['baja', 'rebotado', 'ganado']

export type OutreachRoute = {
  key: string
  label: string
  provinces: string[]
  returnDay: string | null
  position: number
}

export type OutreachTemplate = {
  id: string
  sequence: string
  step: number
  delayDays: number
  subject: string
  body: string
  isActive: boolean
}

export type ProspectForMail = {
  companyName: string
  contactName: string | null
  province: string | null
  city: string | null
  products: string | null
  hook: string | null
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

export const TEMPLATE_VARIABLES: { key: string; help: string }[] = [
  { key: 'saludo', help: '“Hola Juan:” o “Hola, buenos días:” si no hay contacto' },
  { key: 'empresa', help: 'Nombre de la empresa' },
  { key: 'provincia', help: 'Provincia del prospecto' },
  { key: 'localidad', help: 'Localidad (o la provincia si no hay)' },
  { key: 'productos', help: 'Lo que producen (o “su mercadería”)' },
  { key: 'dia_vuelta', help: 'Día de vuelta de la ruta: “los jueves”' },
  { key: 'gancho', help: 'Línea personalizada del prospecto' },
  { key: 'firma', help: 'Firma de la casilla conectada' },
]

export type TemplateVars = Record<string, string>

export function firstName(full: string | null | undefined): string | null {
  const t = full?.trim()
  if (!t) return null
  const first = t.split(/\s+/)[0]
  return first.length >= 2 ? first : null
}

export function buildTemplateVars(p: ProspectForMail, route: Pick<OutreachRoute, 'returnDay'> | null, signature: string): TemplateVars {
  const name = firstName(p.contactName)
  return {
    saludo: name ? `Hola ${name}:` : 'Hola, buenos días:',
    empresa: p.companyName.trim(),
    provincia: p.province?.trim() || '',
    localidad: p.city?.trim() || p.province?.trim() || '',
    // "Peras, manzanas (marca Gaucho)" → "peras, manzanas"
    productos: p.products?.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase() || 'su mercadería',
    dia_vuelta: route?.returnDay?.trim() || '',
    gancho: p.hook?.trim() || '',
    firma: signature.trim(),
  }
}

/**
 * Reemplaza {variable}. Los tramos entre [[ ]] se omiten si alguna variable de
 * adentro está vacía. Variables desconocidas quedan como están (se ven en la vista previa).
 */
export function renderTemplate(text: string, vars: TemplateVars): string {
  const fill = (s: string) => s.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
  const withOptional = text.replace(/\[\[([\s\S]*?)\]\]/g, (_m, inner: string) => {
    const keys = [...inner.matchAll(/\{([a-z_]+)\}/g)].map((x) => x[1])
    return keys.some((k) => !vars[k]?.trim()) ? '' : fill(inner)
  })
  return fill(withOptional)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Variables vacías que el texto usa fuera de un [[ ]] (para avisar en la vista previa). */
export function missingVariables(text: string, vars: TemplateVars): string[] {
  const outside = text.replace(/\[\[[\s\S]*?\]\]/g, '')
  const keys = new Set([...outside.matchAll(/\{([a-z_]+)\}/g)].map((x) => x[1]))
  return [...keys].filter((k) => !(k in vars) || !vars[k]?.trim())
}

export function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

const keyOf = (s: string) => stripAccents(s).toLowerCase().replace(/[^a-z]/g, '')

export function routeForProvince(province: string | null | undefined, routes: OutreachRoute[]): string | null {
  if (!province) return null
  const k = keyOf(province)
  if (!k) return null
  for (const r of routes) if (r.provinces.some((p) => keyOf(p) === k)) return r.key
  return null
}

export function routeFromText(text: string | null | undefined, routes: OutreachRoute[]): string | null {
  if (!text) return null
  const k = keyOf(text)
  if (!k) return null
  const byKey = routes.find((r) => keyOf(r.key) === k || keyOf(r.label) === k)
  if (byKey) return byKey.key
  const byLabel = routes.find((r) => keyOf(r.label).includes(k) || k.includes(keyOf(r.key)))
  if (byLabel) return byLabel.key
  // "Carga de retorno – Tucumán": buscar una provincia dentro del texto
  const byProvince = routes.find((r) => r.provinces.some((p) => keyOf(p).length > 3 && k.includes(keyOf(p))))
  return byProvince?.key ?? null
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** CSV con comillas, separador , o ; (se detecta en la primera línea). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows
}

const HEADER_ALIASES: Record<string, string[]> = {
  companyName: ['empresa', 'name', 'nombre', 'razonsocial', 'company'],
  email: ['email', 'mail', 'mailcontacto', 'correo', 'emailcontacto'],
  emailGeneral: ['mailgeneral', 'emailgeneral'],
  contactName: ['contacto', 'contactname', 'nombrecontacto'],
  contactRole: ['cargo', 'contactrole', 'puesto', 'rol'],
  phone: ['telefono', 'phone', 'tel', 'celular', 'whatsapp'],
  website: ['web', 'website', 'sitio', 'paginaweb'],
  province: ['provincia', 'province'],
  city: ['localidad', 'city', 'ciudad'],
  route: ['ruta', 'route', 'zona', 'segment', 'segmento'],
  products: ['productos', 'products', 'producto', 'rubro'],
  priority: ['prioridad', 'priority'],
  hook: ['gancho', 'hook', 'personalizacion', 'lineapersonalizada'],
  source: ['fuente', 'source'],
  sourceUrl: ['urlfuente', 'sourceurl', 'url'],
  notes: ['notas', 'notes', 'nota', 'observaciones'],
}

export type ProspectImportRow = {
  companyName: string
  email: string | null
  contactName: string | null
  contactRole: string | null
  phone: string | null
  website: string | null
  province: string | null
  city: string | null
  route: string | null
  products: string | null
  priority: ProspectPriority
  hook: string | null
  source: string | null
  sourceUrl: string | null
  notes: string | null
}

export function csvToProspects(text: string): { rows: ProspectImportRow[]; errors: string[] } {
  const table = parseCsv(text)
  if (table.length < 2) return { rows: [], errors: ['El CSV no tiene filas (la primera línea tiene que ser el encabezado)'] }
  const headers = table[0].map((h) => keyOf(h))
  const col: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(h))
    if (idx >= 0) col[field as keyof typeof HEADER_ALIASES] = idx
  }
  if (col.companyName === undefined) return { rows: [], errors: ['Falta la columna "empresa"'] }
  const get = (r: string[], f: keyof typeof HEADER_ALIASES) => {
    const i = col[f]
    const v = i === undefined ? '' : (r[i] ?? '').replace(/\s+/g, ' ').trim()
    return v && v !== '—' && v !== '-' ? v : null
  }
  const rows: ProspectImportRow[] = []
  const errors: string[] = []
  table.slice(1).forEach((r, i) => {
    const companyName = get(r, 'companyName')
    if (!companyName) { errors.push(`Fila ${i + 2}: sin empresa`); return }
    const rawEmail = get(r, 'email') ?? get(r, 'emailGeneral')
    const email = rawEmail ? normalizeEmail(rawEmail.split(/[\s;,/]+/)[0]) : null
    if (rawEmail && !email) errors.push(`Fila ${i + 2} (${companyName}): mail inválido "${rawEmail}"`)
    const pr = keyOf(get(r, 'priority') ?? '')
    rows.push({
      companyName,
      email,
      contactName: get(r, 'contactName'),
      contactRole: get(r, 'contactRole'),
      phone: get(r, 'phone'),
      website: get(r, 'website'),
      province: get(r, 'province'),
      city: get(r, 'city'),
      route: get(r, 'route'),
      products: get(r, 'products'),
      priority: pr === 'alta' || pr === 'baja' ? pr : 'media',
      hook: get(r, 'hook'),
      source: get(r, 'source'),
      sourceUrl: get(r, 'sourceUrl'),
      notes: get(r, 'notes'),
    })
  })
  return { rows, errors }
}

export function prospectNameNorm(name: string): string {
  return normalizeCompanyName(name) || keyOf(name)
}

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------

/** Saca la parte citada de una respuesta ("El lun, ... escribió:", líneas con ">"). */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (/^(el|on)\s.+(escribi[oó]|wrote)\s*:?\s*$/i.test(t)) break
    if (/^-{2,}\s*(mensaje original|original message|forwarded message)/i.test(t)) break
    if (/^(de|from):\s.+@/i.test(t) && out.length > 0) break
    if (t.startsWith('>')) continue
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export type ReplyKind = 'bounce' | 'auto' | 'negative' | 'reply'

export function classifyReply(msg: { fromEmail: string; subject: string; body: string; headers?: Record<string, string> }): ReplyKind {
  const from = msg.fromEmail.toLowerCase()
  const subject = msg.subject.toLowerCase()
  const h = Object.fromEntries(Object.entries(msg.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]))
  if (/^(mailer-daemon|postmaster)@/.test(from) || /(delivery status notification|undeliverable|mail delivery (failed|subsystem)|no se pudo entregar|returned mail|failure notice)/.test(subject)) {
    return 'bounce'
  }
  if ((h['auto-submitted'] && h['auto-submitted'] !== 'no') || h['x-autoreply'] || h['x-autorespond'] ||
      /(respuesta autom[aá]tica|fuera de la oficina|automatic reply|auto.?reply|out of (the )?office|ausente|vacaciones)/.test(subject)) {
    return 'auto'
  }
  const body = stripAccents(stripQuotedReply(msg.body)).toLowerCase().replace(/\s+/g, ' ').trim()
  if (/^(no|no,? gracias|no gracias|baja|no nos interesa|no me interesa|no estamos interesados)[\s.!,]*(saludos.*)?$/.test(body)) return 'negative'
  if (body.length < 400 && /(no nos interesa|no me interesa|no estamos interesad|dar(me|nos)? de baja|no (me|nos) (escriban|envien)|quitar(me|nos)? de|remover(me|nos)?|eliminar(me|nos)? de)/.test(body)) {
    return 'negative'
  }
  return 'reply'
}

// ---------------------------------------------------------------------------
// Mail (MIME) para la API de Gmail
// ---------------------------------------------------------------------------

function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, (m) => `${m}\r\n`).trimEnd()
}

export type MimeInput = {
  fromEmail: string
  fromName: string
  to: string
  subject: string
  body: string
  inReplyTo?: string | null
  references?: string | null
  unsubscribeUrl?: string | null
}

export function buildMime(m: MimeInput): string {
  const headers = [
    `From: ${encodeHeader(m.fromName)} <${m.fromEmail}>`,
    `To: ${m.to}`,
    `Subject: ${encodeHeader(m.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ]
  if (m.inReplyTo) headers.push(`In-Reply-To: ${m.inReplyTo}`)
  if (m.references || m.inReplyTo) headers.push(`References: ${[m.references, m.inReplyTo].filter(Boolean).join(' ')}`)
  if (m.unsubscribeUrl) {
    headers.push(`List-Unsubscribe: <${m.unsubscribeUrl}>, <mailto:${m.fromEmail}?subject=baja>`)
    headers.push('List-Unsubscribe-Post: List-Unsubscribe=One-Click')
  }
  return `${headers.join('\r\n')}\r\n\r\n${wrap76(Buffer.from(m.body.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64'))}`
}

export function base64Url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeBase64Url(s: string): string {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

/** "Juan Pérez <juan@x.com>" → { name, email } */
export function parseAddress(raw: string): { name: string | null; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() }
  return { name: null, email: raw.trim().toLowerCase() }
}

// ---------------------------------------------------------------------------
// Horarios (Argentina)
// ---------------------------------------------------------------------------

const TZ = 'America/Argentina/Buenos_Aires'

export function argentinaClock(now: Date): { hour: number; weekday: number; date: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now).map((p) => [p.type, p.value]),
  )
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return { hour: Number(parts.hour), weekday, date: `${parts.year}-${parts.month}-${parts.day}` }
}

/** Comienzo del día de hoy en Argentina (UTC-3, sin horario de verano). */
export function argentinaDayStart(now: Date): Date {
  return new Date(`${argentinaClock(now).date}T00:00:00-03:00`)
}

export function inSendWindow(now: Date, cfg: { sendHourFrom: number; sendHourTo: number; weekdaysOnly: boolean }): boolean {
  const { hour, weekday } = argentinaClock(now)
  if (cfg.weekdaysOnly && (weekday === 0 || weekday === 6)) return false
  return hour >= cfg.sendHourFrom && hour < cfg.sendHourTo
}

/** Próximo envío: N días después, a las 10 h de Argentina, salteando fin de semana. */
export function nextSendDate(from: Date, days: number): Date {
  const base = argentinaClock(new Date(from.getTime() + days * 86_400_000)).date
  let d = new Date(`${base}T10:00:00-03:00`)
  for (let i = 0; i < 3; i++) {
    const wd = argentinaClock(d).weekday
    if (wd !== 0 && wd !== 6) break
    d = new Date(d.getTime() + 86_400_000)
  }
  return d
}
