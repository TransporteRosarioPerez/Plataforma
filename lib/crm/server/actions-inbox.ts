'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import type { ActionState } from '@/lib/validations/parse-form'
import { buildInboundRow } from '../inbound'
import {
  cleanDisplayName,
  companyDomainFromEmail,
  normalizeCompanyName,
  normalizeCuit,
  normalizeEmail,
  normalizePhone,
} from '../normalize'
import { provinceOf } from '../places'
import { suggestPrice } from '../pricing'
import { mapRate, RATE_COLUMNS } from './mappers'
import { revalidateCrm } from './revalidate'
import { currentUserId, fail, friendly, logEvent, topPosition } from './shared'

const channelSchema = z.enum(['whatsapp', 'email', 'landing', 'phone', 'other'])
const serviceSchema = z.enum(['congelado', 'refrigerado', 'controlada', 'seco']).nullable()
const loadTypeSchema = z.enum(['completa', 'parcial']).nullable()
const frequencySchema = z.enum(['unica', 'semanal', 'quincenal', 'mensual']).nullable()
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
const optText = (max: number) => z.string().max(max).nullable().optional()

// ---------------------------------------------------------------------------
// Carga manual (WhatsApp / mail pegado, llamado)
// ---------------------------------------------------------------------------

const manualSchema = z.object({
  channel: channelSchema,
  receivedAt: z.string().optional(),
  message: z.string().max(8000).optional().default(''),
  name: optText(120),
  company: optText(160),
  email: optText(200),
  phone: optText(40),
})

export async function createManualRequest(input: z.infer<typeof manualSchema>): Promise<ActionState & { id?: string }> {
  try {
    await requireSuperadmin()
    const parsed = manualSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    if (!d.message.trim() && !d.company && !d.name) return { error: 'Pegá el mensaje o completá al menos la empresa' }
    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    const row = buildInboundRow({ ...d, receivedAt: d.receivedAt || undefined })
    const { data, error } = await supabase
      .from('crm_inbound_requests')
      .insert({ ...row, created_by: userId })
      .select('id')
      .single()
    if (error) return { error: friendly(error.message) }
    revalidateCrm()
    return { success: 'Pedido cargado en la bandeja', id: data.id as string }
  } catch (e) {
    return fail(e, 'Error al cargar el pedido')
  }
}

// ---------------------------------------------------------------------------
// Aceptar: asignar empresa (existente o nueva) y crear la cotización
// ---------------------------------------------------------------------------

const acceptSchema = z.object({
  requestId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  newCompany: z.object({ name: z.string().min(1, 'Nombre de empresa requerido').max(160), cuit: z.string().max(20).nullable() }).nullable(),
  saveAlias: z.boolean(),
  contact: z.object({ name: optText(120), email: optText(200), phone: optText(40) }),
  quote: z.object({
    origin: optText(120),
    destination: optText(120),
    serviceType: serviceSchema,
    loadType: loadTypeSchema,
    pallets: z.number().int().positive().max(500).nullable(),
    weightKg: z.number().positive().nullable(),
    loadDate: dateSchema,
    frequency: frequencySchema,
    description: optText(4000),
  }),
})

export type AcceptRequestInput = z.infer<typeof acceptSchema>

export async function acceptRequest(input: AcceptRequestInput): Promise<ActionState & { quoteId?: string }> {
  try {
    await requireSuperadmin()
    const parsed = acceptSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    if (!d.companyId && !d.newCompany) return { error: 'Elegí una empresa o creá una nueva' }

    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    const { data: req, error: reqErr } = await supabase
      .from('crm_inbound_requests')
      .select('id, status, channel, received_at, company_name_raw, sender_email, cuit_raw, message')
      .eq('id', d.requestId)
      .single()
    if (reqErr || !req) return { error: 'No se encontró el pedido' }
    if (req.status !== 'pending') return { error: 'Este pedido ya fue procesado' }

    const contactEmail = normalizeEmail(d.contact.email)
    const corporateDomain = companyDomainFromEmail(contactEmail ?? req.sender_email)

    // 1. Empresa
    let companyId = d.companyId
    let companyName = ''
    let companyNorm = ''
    let createdCompany = false
    if (!companyId && d.newCompany) {
      const name = cleanDisplayName(d.newCompany.name)
      const norm = normalizeCompanyName(name)
      if (!norm) return { error: 'El nombre de la empresa no es válido' }
      const cuit = normalizeCuit(d.newCompany.cuit) ?? normalizeCuit(req.cuit_raw)
      const { data: existing } = await supabase.from('crm_companies').select('id, name').eq('name_norm', norm).is('deleted_at', null).maybeSingle()
      if (existing) return { error: `Ya existe "${existing.name}". Elegila de la lista en lugar de crear una nueva.` }
      const { data: created, error } = await supabase
        .from('crm_companies')
        .insert({ name, name_norm: norm, cuit, email_domain: corporateDomain, created_by: userId })
        .select('id')
        .single()
      if (error) return { error: friendly(error.message) }
      companyId = created.id as string
      companyName = name
      companyNorm = norm
      createdCompany = true
    } else {
      const { data: company } = await supabase.from('crm_companies').select('id, name, name_norm, cuit, email_domain').eq('id', companyId!).single()
      if (!company) return { error: 'La empresa elegida no existe' }
      companyName = company.name as string
      companyNorm = company.name_norm as string
      // Completar datos que falten con lo que trajo el pedido
      const patch: Record<string, string> = {}
      if (!company.email_domain && corporateDomain) patch.email_domain = corporateDomain
      const cuit = normalizeCuit(req.cuit_raw)
      if (!company.cuit && cuit) patch.cuit = cuit
      if (Object.keys(patch).length) await supabase.from('crm_companies').update(patch).eq('id', companyId!)
    }

    // 2. Alias ("Lenevo" → Lenovo) para que matchee solo la próxima vez
    const written = (req.company_name_raw as string | null)?.trim()
    const writtenNorm = normalizeCompanyName(written)
    if (d.saveAlias && written && writtenNorm && writtenNorm !== companyNorm) {
      await supabase
        .from('crm_company_aliases')
        .upsert({ company_id: companyId, alias: written, alias_norm: writtenNorm, source: 'triage', created_by: userId }, { onConflict: 'alias_norm', ignoreDuplicates: true })
    }

    // 3. Contacto (reusar si ya existe por mail o teléfono)
    let contactId: string | null = null
    const phoneNorm = normalizePhone(d.contact.phone)
    if (contactEmail || phoneNorm || d.contact.name) {
      const { data: contacts } = await supabase.from('crm_contacts').select('id, name, email, phone_norm').eq('company_id', companyId!).is('deleted_at', null)
      const match = (contacts ?? []).find(
        (c) => (contactEmail && (c.email as string | null)?.toLowerCase() === contactEmail) || (phoneNorm && c.phone_norm === phoneNorm),
      )
      if (match) {
        contactId = match.id as string
        const patch: Record<string, string> = {}
        if (!match.name && d.contact.name) patch.name = d.contact.name
        if (!match.email && contactEmail) patch.email = contactEmail
        if (!match.phone_norm && phoneNorm) { patch.phone = d.contact.phone!; patch.phone_norm = phoneNorm }
        if (Object.keys(patch).length) await supabase.from('crm_contacts').update(patch).eq('id', contactId)
      } else {
        const { data: c } = await supabase
          .from('crm_contacts')
          .insert({ company_id: companyId, name: d.contact.name || null, email: contactEmail, phone: d.contact.phone || null, phone_norm: phoneNorm })
          .select('id')
          .single()
        contactId = (c?.id as string) ?? null
      }
    }

    // 4. Cotización en el Board (etapa Nuevo, arriba de todo)
    const q = d.quote
    const destinationProvince = provinceOf(q.destination) ?? null
    let suggestedAmount: number | null = null
    if (destinationProvince) {
      const { data: rate } = await supabase.from('crm_rates').select(RATE_COLUMNS).eq('province', destinationProvince).maybeSingle()
      suggestedAmount = suggestPrice(rate ? mapRate(rate) : null, q)?.amount ?? null
    }
    const { data: quote, error: qErr } = await supabase
      .from('crm_quotes')
      .insert({
        company_id: companyId,
        contact_id: contactId,
        inbound_request_id: d.requestId,
        channel: req.channel,
        stage: 'nuevo',
        position: await topPosition(supabase, 'nuevo'),
        received_at: req.received_at,
        service_type: q.serviceType,
        load_type: q.loadType,
        origin: q.origin || null,
        destination: q.destination || null,
        destination_province: destinationProvince,
        pallets: q.pallets,
        weight_kg: q.weightKg,
        load_date: q.loadDate,
        frequency: q.frequency,
        description: q.description || null,
        suggested_amount: suggestedAmount,
        created_by: userId,
      })
      .select('id, number')
      .single()
    if (qErr) return { error: friendly(qErr.message) }

    await supabase
      .from('crm_inbound_requests')
      .update({ status: 'accepted', company_id: companyId, quote_id: quote.id, triaged_by: userId, triaged_at: new Date().toISOString() })
      .eq('id', d.requestId)
    await logEvent(supabase, quote.id as string, { kind: 'created', toStage: 'nuevo', body: createdCompany ? `Empresa nueva: ${companyName}` : null }, userId)
    await logAudit({
      action: AUDIT_ACTIONS.crmRequestAccept,
      entityType: 'crm_quote',
      entityId: quote.id as string,
      entityLabel: companyName,
      summary: `Pasó al board un pedido de ${companyName}${createdCompany ? ' (empresa nueva)' : ''}`,
      metadata: { requestId: d.requestId, channel: req.channel, alias: d.saveAlias && writtenNorm !== companyNorm ? written : null },
    })
    revalidateCrm()
    return { success: `${companyName} pasó al board`, quoteId: quote.id as string }
  } catch (e) {
    return fail(e, 'Error al aceptar el pedido')
  }
}

// ---------------------------------------------------------------------------
// Descartar / volver a la bandeja
// ---------------------------------------------------------------------------

export async function discardRequest(id: string, reason: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!z.string().uuid().safeParse(id).success) return { error: 'Pedido inválido' }
    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    const { error } = await supabase
      .from('crm_inbound_requests')
      .update({ status: 'discarded', discard_reason: reason.slice(0, 200) || null, triaged_by: userId, triaged_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
    if (error) return { error: error.message }
    await logAudit({ action: AUDIT_ACTIONS.crmRequestDiscard, entityType: 'crm_inbound_request', entityId: id, summary: `Descartó un pedido (${reason})` })
    revalidateCrm()
    return { success: 'Pedido descartado' }
  } catch (e) {
    return fail(e, 'Error al descartar')
  }
}

export async function reopenRequest(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const supabase = await createClient()
    const { error } = await supabase
      .from('crm_inbound_requests')
      .update({ status: 'pending', discard_reason: null, triaged_at: null, triaged_by: null })
      .eq('id', id)
      .eq('status', 'discarded')
    if (error) return { error: error.message }
    revalidateCrm()
    return { success: 'El pedido volvió a la bandeja' }
  } catch (e) {
    return fail(e, 'Error al recuperar el pedido')
  }
}
