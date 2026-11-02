/**
 * Arma la fila de crm_inbound_requests a partir de lo que llega (form de la landing,
 * mensaje pegado, webhook). Combina los campos explícitos con lo que se pueda leer del texto.
 * Puro: lo usan el endpoint público y la acción de carga manual.
 */
import { normalizeCuit, normalizeEmail } from './normalize'
import { parseRequestText } from './parse'
import { provinceOf } from './places'
import type { CrmChannel, CrmFrequency, CrmLoadType, CrmServiceType, ParsedRequest } from './types'

export type InboundInput = {
  channel: CrmChannel
  receivedAt?: string
  name?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  cuit?: string | null
  subject?: string | null
  message?: string | null
  origin?: string | null
  destination?: string | null
  serviceType?: CrmServiceType | null
  loadType?: CrmLoadType | null
  pallets?: number | null
  weightKg?: number | null
  loadDate?: string | null
  frequency?: CrmFrequency | null
  externalId?: string | null
  meta?: Record<string, unknown>
}

const clean = (s: string | null | undefined, max = 200) => {
  const t = s?.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

export function buildInboundRow(input: InboundInput) {
  const received = input.receivedAt ? new Date(input.receivedAt) : new Date()
  const textParsed: ParsedRequest = input.message ? parseRequestText([input.subject, input.message].filter(Boolean).join('\n'), received) : {}
  // Los campos explícitos del formulario mandan sobre lo leído del texto
  const parsed: ParsedRequest = { ...textParsed }
  if (input.origin) { parsed.origin = clean(input.origin)!; parsed.originProvince = provinceOf(input.origin) ?? parsed.originProvince }
  if (input.destination) { parsed.destination = clean(input.destination)!; parsed.destinationProvince = provinceOf(input.destination) ?? parsed.destinationProvince }
  if (input.serviceType) parsed.serviceType = input.serviceType
  if (input.loadType) parsed.loadType = input.loadType
  if (input.pallets) parsed.pallets = input.pallets
  if (input.weightKg) parsed.weightKg = input.weightKg
  if (input.loadDate) parsed.loadDate = input.loadDate
  if (input.frequency) parsed.frequency = input.frequency
  for (const k of Object.keys(parsed) as (keyof ParsedRequest)[]) if (parsed[k] === undefined) delete parsed[k]

  const email = normalizeEmail(input.email) ?? parsed.emails?.[0] ?? null
  const phone = clean(input.phone, 40) ?? parsed.phones?.[0] ?? null
  return {
    channel: input.channel,
    received_at: received.toISOString(),
    sender_name: clean(input.name, 120) ?? parsed.senderName ?? null,
    sender_email: email,
    sender_phone: phone,
    company_name_raw: clean(input.company, 160) ?? parsed.companyName ?? null,
    cuit_raw: normalizeCuit(input.cuit) ?? parsed.cuit ?? null,
    subject: clean(input.subject, 200),
    message: input.message?.trim().slice(0, 8000) || null,
    parsed,
    external_id: clean(input.externalId, 200),
    meta: input.meta ?? {},
  }
}
