import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireSuperadmin } from '@/lib/auth/session'
import {
  argentinaDayStart,
  type OutreachRoute,
  type OutreachStatus,
  type OutreachTemplate,
  type ProspectPriority,
  type ProspectStatus,
} from '../prospecting'
import { gmailConfigured } from './gmail'

export type OutreachMessageRow = {
  step: number
  subject: string | null
  body: string | null
  status: 'sent' | 'failed'
  error: string | null
  sentAt: string
}

export type ProspectRow = {
  id: string
  companyId: string | null
  companyName: string
  routeKey: string | null
  province: string | null
  city: string | null
  products: string | null
  contactName: string | null
  contactRole: string | null
  email: string | null
  phone: string | null
  website: string | null
  priority: ProspectPriority
  hook: string | null
  source: string | null
  sourceUrl: string | null
  notes: string | null
  status: ProspectStatus
  lastContactedAt: string | null
  repliedAt: string | null
  createdAt: string
  suppressed: string | null
  outreach: {
    id: string
    status: OutreachStatus
    nextStep: number
    nextSendAt: string | null
    error: string | null
    inboundRequestId: string | null
    messages: OutreachMessageRow[]
  } | null
}

export type GmailConnectionInfo = {
  email: string
  senderName: string
  signature: string
  dailyLimit: number
  sendHourFrom: number
  sendHourTo: number
  weekdaysOnly: boolean
  connectedAt: string
  lastSyncAt: string | null
  lastError: string | null
}

export type ProspectsPageData = {
  prospects: ProspectRow[]
  routes: OutreachRoute[]
  templates: OutreachTemplate[]
  connection: GmailConnectionInfo | null
  gmail: { configured: boolean; missing: string[] }
  sentToday: number
  dueNow: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export function mapRoute(r: Row): OutreachRoute {
  return { key: r.key, label: r.label, provinces: r.provinces ?? [], returnDay: r.return_day, position: r.position }
}

export function mapTemplate(r: Row): OutreachTemplate {
  return { id: r.id, sequence: r.sequence, step: r.step, delayDays: r.delay_days, subject: r.subject, body: r.body, isActive: r.is_active }
}

export async function getOutreachSetup(): Promise<{ routes: OutreachRoute[]; templates: OutreachTemplate[]; signature: string }> {
  await requireSuperadmin()
  const supabase = await createClient()
  const [routes, templates] = await Promise.all([
    supabase.from('crm_outreach_routes').select('*').order('position'),
    supabase.from('crm_outreach_templates').select('*').order('sequence').order('step'),
  ])
  if (routes.error) throw new Error(routes.error.message)
  if (templates.error) throw new Error(templates.error.message)
  const conn = await createServiceRoleClient().from('crm_gmail_connection').select('signature').eq('id', 1).maybeSingle()
  return {
    routes: (routes.data ?? []).map(mapRoute),
    templates: (templates.data ?? []).map(mapTemplate),
    signature: conn.data?.signature ?? 'Rosario Perez\nTransporte Rosario Perez\nWhatsApp 3329 64-3639',
  }
}

async function all(build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}

export async function getProspectsPageData(): Promise<ProspectsPageData> {
  await requireSuperadmin()
  const supabase = await createClient()
  const now = new Date()
  const [{ routes, templates }, prospects, outreach, messages, suppressions, sentToday, dueNow] = await Promise.all([
    getOutreachSetup(),
    all((a, b) => supabase.from('crm_prospects').select('*').is('deleted_at', null).order('created_at', { ascending: false }).range(a, b)),
    all((a, b) => supabase.from('crm_outreach').select('id, prospect_id, status, next_step, next_send_at, error, inbound_request_id, created_at').order('created_at', { ascending: true }).range(a, b)),
    all((a, b) => supabase.from('crm_outreach_messages').select('outreach_id, step, subject, body, status, error, sent_at').order('sent_at', { ascending: true }).range(a, b)),
    all((a, b) => supabase.from('crm_email_suppressions').select('email, reason').range(a, b)),
    supabase.from('crm_outreach_messages').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', argentinaDayStart(now).toISOString()),
    supabase.from('crm_outreach').select('id', { count: 'exact', head: true }).eq('status', 'activa').lte('next_send_at', now.toISOString()),
  ])

  const msgsBy = new Map<string, OutreachMessageRow[]>()
  for (const m of messages) {
    const list = msgsBy.get(m.outreach_id) ?? []
    list.push({ step: m.step, subject: m.subject, body: m.body, status: m.status, error: m.error, sentAt: m.sent_at })
    msgsBy.set(m.outreach_id, list)
  }
  const latest = new Map<string, Row>()
  for (const o of outreach) latest.set(o.prospect_id, o) // ordenado ascendente: queda la última
  const supp = new Map(suppressions.map((s) => [s.email, s.reason as string]))

  const conn = await createServiceRoleClient()
    .from('crm_gmail_connection')
    .select('email, sender_name, signature, daily_limit, send_hour_from, send_hour_to, weekdays_only, connected_at, last_sync_at, last_error')
    .eq('id', 1)
    .maybeSingle()
  const c = conn.data
  const g = gmailConfigured()

  return {
    routes,
    templates,
    gmail: { configured: g.ok, missing: g.missing },
    sentToday: sentToday.count ?? 0,
    dueNow: dueNow.count ?? 0,
    connection: c
      ? {
          email: c.email, senderName: c.sender_name, signature: c.signature, dailyLimit: c.daily_limit,
          sendHourFrom: c.send_hour_from, sendHourTo: c.send_hour_to, weekdaysOnly: c.weekdays_only,
          connectedAt: c.connected_at, lastSyncAt: c.last_sync_at, lastError: c.last_error,
        }
      : null,
    prospects: prospects.map((p) => {
      const o = latest.get(p.id)
      return {
        id: p.id, companyId: p.company_id, companyName: p.company_name, routeKey: p.route_key,
        province: p.province, city: p.city, products: p.products, contactName: p.contact_name,
        contactRole: p.contact_role, email: p.email, phone: p.phone, website: p.website,
        priority: p.priority, hook: p.hook, source: p.source, sourceUrl: p.source_url, notes: p.notes,
        status: p.status, lastContactedAt: p.last_contacted_at, repliedAt: p.replied_at, createdAt: p.created_at,
        suppressed: p.email ? supp.get(String(p.email).toLowerCase()) ?? null : null,
        outreach: o
          ? {
              id: o.id, status: o.status, nextStep: o.next_step, nextSendAt: o.next_send_at, error: o.error,
              inboundRequestId: o.inbound_request_id, messages: msgsBy.get(o.id) ?? [],
            }
          : null,
      }
    }),
  }
}
