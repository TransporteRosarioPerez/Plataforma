import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { findCompanyCandidates, findDuplicateCompanies, type MatchCandidate, type MatchCatalog } from '../matching'
import { normalizeCompanyName } from '../normalize'
import type { CrmAlias, CrmCompany, CrmContact, CrmInboundRequest, CrmQuote, CrmQuoteEvent, CrmRate } from '../types'
import {
  ALIAS_COLUMNS,
  COMPANY_COLUMNS,
  CONTACT_COLUMNS,
  EVENT_COLUMNS,
  INBOUND_COLUMNS,
  QUOTE_COLUMNS,
  RATE_COLUMNS,
  mapAlias,
  mapCompany,
  mapContact,
  mapEvent,
  mapInbound,
  mapQuote,
  mapRate,
} from './mappers'

const PAGE = 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>, map: (r: any) => T): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows.map(map))
    if (rows.length < PAGE) break
  }
  return out
}

// ---------------------------------------------------------------------------
// Catálogo de empresas (para matching y selects)
// ---------------------------------------------------------------------------

export type CrmCatalog = {
  companies: CrmCompany[]
  aliases: CrmAlias[]
  contacts: CrmContact[]
}

export const getCatalog = cache(async (): Promise<CrmCatalog> => {
  await requireSuperadmin()
  const supabase = await createClient()
  const [companies, aliases, contacts] = await Promise.all([
    fetchAll((f, t) => supabase.from('crm_companies').select(COMPANY_COLUMNS).is('deleted_at', null).order('name').range(f, t), mapCompany),
    fetchAll((f, t) => supabase.from('crm_company_aliases').select(ALIAS_COLUMNS).order('alias').range(f, t), mapAlias),
    fetchAll((f, t) => supabase.from('crm_contacts').select(CONTACT_COLUMNS).is('deleted_at', null).range(f, t), mapContact),
  ])
  return { companies, aliases, contacts }
})

export function toMatchCatalog(c: CrmCatalog): MatchCatalog {
  const live = new Set(c.companies.map((x) => x.id))
  return {
    companies: c.companies,
    aliases: c.aliases.filter((a) => live.has(a.companyId)),
    contacts: c.contacts.filter((x) => live.has(x.companyId)),
  }
}

// ---------------------------------------------------------------------------
// Bandeja
// ---------------------------------------------------------------------------

export type PendingRequest = CrmInboundRequest & {
  candidates: MatchCandidate[]
  /** Otro pedido pendiente/reciente del mismo remitente (posible duplicado). */
  possibleDuplicateOf: string | null
}

export async function getPendingCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('crm_inbound_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .is('deleted_at', null)
  return count ?? 0
}

export async function getInbox(): Promise<{ pending: PendingRequest[]; recent: CrmInboundRequest[] }> {
  await requireSuperadmin()
  const supabase = await createClient()
  const since = new Date(Date.now() - 14 * 86400000).toISOString()
  const [catalog, pendingRes, recentRes] = await Promise.all([
    getCatalog(),
    supabase.from('crm_inbound_requests').select(INBOUND_COLUMNS).eq('status', 'pending').is('deleted_at', null).order('received_at', { ascending: true }),
    supabase.from('crm_inbound_requests').select(INBOUND_COLUMNS).neq('status', 'pending').is('deleted_at', null).gte('received_at', since).order('triaged_at', { ascending: false }).limit(50),
  ])
  if (pendingRes.error) throw new Error(pendingRes.error.message)
  const matchCatalog = toMatchCatalog(catalog)
  const pending = (pendingRes.data ?? []).map(mapInbound)
  const recent = (recentRes.data ?? []).map(mapInbound)
  const all = [...pending, ...recent]
  return {
    pending: pending.map((r) => ({
      ...r,
      candidates: findCompanyCandidates(
        {
          companyName: r.companyNameRaw ?? r.parsed.companyName,
          cuit: r.cuitRaw ?? r.parsed.cuit,
          emails: [r.senderEmail, ...(r.parsed.emails ?? [])],
          phones: [r.senderPhone, ...(r.parsed.phones ?? [])],
        },
        matchCatalog,
      ),
      possibleDuplicateOf: findDuplicateRequest(r, all),
    })),
    recent,
  }
}

function findDuplicateRequest(r: CrmInboundRequest, all: CrmInboundRequest[]): string | null {
  const key = (x: CrmInboundRequest) => [x.senderEmail?.toLowerCase(), x.senderPhone?.replace(/\D/g, '').slice(-8)].filter(Boolean)
  const mine = key(r)
  if (!mine.length) return null
  const t = new Date(r.receivedAt).getTime()
  for (const o of all) {
    if (o.id === r.id || o.status === 'discarded') continue
    const dt = Math.abs(new Date(o.receivedAt).getTime() - t)
    if (dt > 2 * 86400000) continue
    // Sólo marcamos el más nuevo como duplicado del más viejo
    if (new Date(o.receivedAt).getTime() > t) continue
    if (key(o).some((k) => mine.includes(k))) return o.id
  }
  return null
}

// ---------------------------------------------------------------------------
// Board / cotizaciones
// ---------------------------------------------------------------------------

/** Abiertas + cerradas en los últimos `closedDays` días. */
export async function getBoardQuotes(closedDays = 45): Promise<CrmQuote[]> {
  await requireSuperadmin()
  const supabase = await createClient()
  const since = new Date(Date.now() - closedDays * 86400000).toISOString()
  const { data, error } = await supabase
    .from('crm_quotes')
    .select(QUOTE_COLUMNS)
    .is('deleted_at', null)
    .or(`stage.not.in.(ganada,perdida),decided_at.gte.${since}`)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapQuote)
}

export async function getAllQuotes(): Promise<CrmQuote[]> {
  await requireSuperadmin()
  const supabase = await createClient()
  return fetchAll(
    (f, t) => supabase.from('crm_quotes').select(QUOTE_COLUMNS).is('deleted_at', null).order('received_at', { ascending: false }).range(f, t),
    mapQuote,
  )
}

export async function getQuote(id: string): Promise<{ quote: CrmQuote; events: CrmQuoteEvent[]; request: CrmInboundRequest | null } | null> {
  await requireSuperadmin()
  const supabase = await createClient()
  const { data, error } = await supabase.from('crm_quotes').select(QUOTE_COLUMNS).eq('id', id).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const quote = mapQuote(data)
  const [eventsRes, requestRes, profilesRes] = await Promise.all([
    supabase.from('crm_quote_events').select(EVENT_COLUMNS).eq('quote_id', id).order('created_at', { ascending: false }),
    quote.inboundRequestId
      ? supabase.from('crm_inbound_requests').select(INBOUND_COLUMNS).eq('id', quote.inboundRequestId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('profiles').select('id, name'),
  ])
  const names = new Map<string, string>((profilesRes.data ?? []).map((p) => [p.id as string, p.name as string]))
  return {
    quote,
    events: (eventsRes.data ?? []).map((e) => mapEvent(e, names)),
    request: requestRes.data ? mapInbound(requestRes.data) : null,
  }
}

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

export type CompanyRow = CrmCompany & {
  aliases: string[]
  contacts: number
  requests: number
  quotes: number
  won: number
  open: number
  wonAmount: number
  lastContactAt: string | null
  services: string[]
  destinations: string[]
}

export async function getCompaniesWithStats(): Promise<{ rows: CompanyRow[]; duplicates: { a: CompanyRow; b: CompanyRow; similarity: number }[] }> {
  await requireSuperadmin()
  const supabase = await createClient()
  const [catalog, quotes, requestsRes] = await Promise.all([
    getCatalog(),
    getAllQuotes(),
    supabase.from('crm_inbound_requests').select('company_id, received_at').is('deleted_at', null).not('company_id', 'is', null),
  ])
  const rows = new Map<string, CompanyRow>()
  for (const c of catalog.companies) {
    rows.set(c.id, {
      ...c,
      aliases: catalog.aliases.filter((a) => a.companyId === c.id).map((a) => a.alias),
      contacts: catalog.contacts.filter((x) => x.companyId === c.id).length,
      requests: 0, quotes: 0, won: 0, open: 0, wonAmount: 0, lastContactAt: null, services: [], destinations: [],
    })
  }
  const touch = (r: CompanyRow, iso: string) => {
    if (!r.lastContactAt || iso > r.lastContactAt) r.lastContactAt = iso
  }
  for (const req of requestsRes.data ?? []) {
    const r = rows.get(req.company_id as string)
    if (!r) continue
    r.requests++
    touch(r, req.received_at as string)
  }
  for (const q of quotes) {
    const r = rows.get(q.companyId)
    if (!r) continue
    r.quotes++
    if (q.stage === 'ganada') { r.won++; r.wonAmount += q.quotedAmount ?? 0 }
    else if (q.stage !== 'perdida') r.open++
    if (q.serviceType && !r.services.includes(q.serviceType)) r.services.push(q.serviceType)
    const dest = q.destinationProvince ?? q.destination
    if (dest && !r.destinations.includes(dest)) r.destinations.push(dest)
    touch(r, q.receivedAt)
  }
  const duplicates = findDuplicateCompanies(catalog.companies).map((p) => ({ a: rows.get(p.a)!, b: rows.get(p.b)!, similarity: p.similarity }))
  return {
    rows: [...rows.values()].sort((a, b) => (b.lastContactAt ?? '').localeCompare(a.lastContactAt ?? '') || a.name.localeCompare(b.name)),
    duplicates,
  }
}

export async function getCompanyDetail(id: string) {
  await requireSuperadmin()
  const supabase = await createClient()
  const [companyRes, aliasesRes, contactsRes, quotesRes, requestsRes] = await Promise.all([
    supabase.from('crm_companies').select(COMPANY_COLUMNS).eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('crm_company_aliases').select(ALIAS_COLUMNS).eq('company_id', id).order('alias'),
    supabase.from('crm_contacts').select(CONTACT_COLUMNS).eq('company_id', id).is('deleted_at', null).order('name'),
    supabase.from('crm_quotes').select(QUOTE_COLUMNS).eq('company_id', id).is('deleted_at', null).order('received_at', { ascending: false }),
    supabase.from('crm_inbound_requests').select(INBOUND_COLUMNS).eq('company_id', id).is('deleted_at', null).order('received_at', { ascending: false }),
  ])
  if (!companyRes.data) return null
  return {
    company: mapCompany(companyRes.data),
    aliases: (aliasesRes.data ?? []).map(mapAlias),
    contacts: (contactsRes.data ?? []).map(mapContact),
    quotes: (quotesRes.data ?? []).map(mapQuote),
    requests: (requestsRes.data ?? []).map(mapInbound),
  }
}

// ---------------------------------------------------------------------------
// Tarifario y métricas
// ---------------------------------------------------------------------------

export async function getRates(): Promise<CrmRate[]> {
  await requireSuperadmin()
  const supabase = await createClient()
  const { data, error } = await supabase.from('crm_rates').select(RATE_COLUMNS).order('province')
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRate)
}

export async function getMetricsData() {
  await requireSuperadmin()
  const supabase = await createClient()
  const [catalog, quotes, requests] = await Promise.all([
    getCatalog(),
    getAllQuotes(),
    fetchAll(
      (f, t) => supabase.from('crm_inbound_requests').select('id, channel, status, received_at, company_id').is('deleted_at', null).range(f, t),
      (r) => ({ id: r.id as string, channel: r.channel, status: r.status, receivedAt: r.received_at as string, companyId: r.company_id as string | null }),
    ),
  ])
  return { companies: catalog.companies, quotes, requests }
}

/** Para el formulario de alta manual: ¿ya existe una empresa con este nombre? */
export function sameNameCompany(catalog: CrmCatalog, name: string): CrmCompany | undefined {
  const norm = normalizeCompanyName(name)
  return catalog.companies.find((c) => c.nameNorm === norm)
}
