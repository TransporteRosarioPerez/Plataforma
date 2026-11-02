import type {
  CrmAlias,
  CrmCompany,
  CrmContact,
  CrmInboundRequest,
  CrmQuote,
  CrmQuoteEvent,
  CrmRate,
  ParsedRequest,
} from '../types'

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

export const COMPANY_COLUMNS =
  'id, name, name_norm, cuit, email_domain, website, industry, city, province, notes, created_at'

export function mapCompany(r: any): CrmCompany {
  return {
    id: r.id,
    name: r.name,
    nameNorm: r.name_norm,
    cuit: r.cuit,
    emailDomain: r.email_domain,
    website: r.website,
    industry: r.industry,
    city: r.city,
    province: r.province,
    notes: r.notes,
    createdAt: r.created_at,
  }
}

export const ALIAS_COLUMNS = 'id, company_id, alias, alias_norm, source'

export function mapAlias(r: any): CrmAlias {
  return { id: r.id, companyId: r.company_id, alias: r.alias, aliasNorm: r.alias_norm, source: r.source }
}

export const CONTACT_COLUMNS = 'id, company_id, name, email, phone, phone_norm, role'

export function mapContact(r: any): CrmContact {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    phoneNorm: r.phone_norm,
    role: r.role,
  }
}

export const INBOUND_COLUMNS =
  'id, channel, status, received_at, sender_name, sender_email, sender_phone, company_name_raw, cuit_raw, subject, message, parsed, company_id, quote_id, discard_reason, triaged_at'

export function mapInbound(r: any): CrmInboundRequest {
  return {
    id: r.id,
    channel: r.channel,
    status: r.status,
    receivedAt: r.received_at,
    senderName: r.sender_name,
    senderEmail: r.sender_email,
    senderPhone: r.sender_phone,
    companyNameRaw: r.company_name_raw,
    cuitRaw: r.cuit_raw,
    subject: r.subject,
    message: r.message,
    parsed: (r.parsed ?? {}) as ParsedRequest,
    companyId: r.company_id,
    quoteId: r.quote_id,
    discardReason: r.discard_reason,
    triagedAt: r.triaged_at,
  }
}

export const QUOTE_COLUMNS = `id, number, company_id, contact_id, inbound_request_id, channel, stage, stage_changed_at, position,
  received_at, service_type, load_type, origin, destination, destination_province, pallets, weight_kg, load_date, frequency,
  description, suggested_amount, quoted_amount, sent_at, decided_at, valid_until, lost_reason, lost_notes, next_followup_at, created_at,
  company:crm_companies!crm_quotes_company_id_fkey(name),
  contact:crm_contacts!crm_quotes_contact_id_fkey(name, email, phone)`

export function mapQuote(r: any): CrmQuote {
  const company = Array.isArray(r.company) ? r.company[0] : r.company
  const contact = Array.isArray(r.contact) ? r.contact[0] : r.contact
  return {
    id: r.id,
    number: Number(r.number),
    companyId: r.company_id,
    companyName: company?.name ?? '—',
    contactId: r.contact_id,
    contactName: contact?.name ?? null,
    contactEmail: contact?.email ?? null,
    contactPhone: contact?.phone ?? null,
    inboundRequestId: r.inbound_request_id,
    channel: r.channel,
    stage: r.stage,
    stageChangedAt: r.stage_changed_at,
    position: Number(r.position),
    receivedAt: r.received_at,
    serviceType: r.service_type,
    loadType: r.load_type,
    origin: r.origin,
    destination: r.destination,
    destinationProvince: r.destination_province,
    pallets: num(r.pallets),
    weightKg: num(r.weight_kg),
    loadDate: r.load_date,
    frequency: r.frequency,
    description: r.description,
    suggestedAmount: num(r.suggested_amount),
    quotedAmount: num(r.quoted_amount),
    sentAt: r.sent_at,
    decidedAt: r.decided_at,
    validUntil: r.valid_until,
    lostReason: r.lost_reason,
    lostNotes: r.lost_notes,
    nextFollowupAt: r.next_followup_at,
    createdAt: r.created_at,
  }
}

export const EVENT_COLUMNS = 'id, quote_id, kind, from_stage, to_stage, body, metadata, created_by, created_at'

export function mapEvent(r: any, names: Map<string, string>): CrmQuoteEvent {
  return {
    id: r.id,
    quoteId: r.quote_id,
    kind: r.kind,
    fromStage: r.from_stage,
    toStage: r.to_stage,
    body: r.body,
    metadata: r.metadata ?? {},
    createdBy: r.created_by,
    createdByName: r.created_by ? names.get(r.created_by) ?? null : null,
    createdAt: r.created_at,
  }
}

export const RATE_COLUMNS = 'id, province, price_per_pallet, price_full_truck, frozen_surcharge_pct, notes, is_active'

export function mapRate(r: any): CrmRate {
  return {
    id: r.id,
    province: r.province,
    pricePerPallet: num(r.price_per_pallet),
    priceFullTruck: num(r.price_full_truck),
    frozenSurchargePct: Number(r.frozen_surcharge_pct ?? 0),
    notes: r.notes,
    isActive: !!r.is_active,
  }
}
