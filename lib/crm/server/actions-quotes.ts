'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import type { ActionState } from '@/lib/validations/parse-form'
import { DEFAULT_VALIDITY_DAYS, STAGE_LABELS } from '../constants'
import { provinceOf } from '../places'
import { suggestPrice } from '../pricing'
import { quoteCode } from '../quote-message'
import type { CrmStage } from '../types'
import { mapRate, RATE_COLUMNS } from './mappers'
import { revalidateCrm } from './revalidate'
import { currentUserId, fail, logEvent, topPosition, type SupabaseServer } from './shared'

const stageSchema = z.enum(['nuevo', 'cotizando', 'enviada', 'negociacion', 'ganada', 'perdida'])
const uuid = z.string().uuid()

function plusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Mover en el board
// ---------------------------------------------------------------------------

const moveSchema = z.object({
  id: uuid,
  stage: stageSchema,
  position: z.number().finite(),
  quotedAmount: z.number().positive().nullable().optional(),
  lostReason: z.string().max(80).nullable().optional(),
  lostNotes: z.string().max(1000).nullable().optional(),
})

export async function moveQuote(input: z.infer<typeof moveSchema>): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const parsed = moveSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    const { data: cur } = await supabase
      .from('crm_quotes')
      .select('id, number, stage, quoted_amount, sent_at, valid_until, company:crm_companies!crm_quotes_company_id_fkey(name)')
      .eq('id', d.id)
      .single()
    if (!cur) return { error: 'No se encontró la cotización' }
    const from = cur.stage as CrmStage
    return await applyStage(supabase, userId, cur, from, d)
  } catch (e) {
    return fail(e, 'Error al mover la cotización')
  }
}

async function applyStage(
  supabase: SupabaseServer,
  userId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cur: any,
  from: CrmStage,
  d: z.infer<typeof moveSchema>,
): Promise<ActionState> {
  const to = d.stage
  const patch: Record<string, unknown> = { position: d.position }
  const quoted = d.quotedAmount ?? (cur.quoted_amount === null ? null : Number(cur.quoted_amount))
  if (to !== from) {
    if ((to === 'enviada' || to === 'negociacion' || to === 'ganada') && !quoted) {
      return { error: 'Cargá el precio cotizado antes de pasar a esa etapa' }
    }
    if (to === 'perdida' && !d.lostReason) return { error: 'Indicá el motivo por el que se perdió' }
    patch.stage = to
    patch.stage_changed_at = new Date().toISOString()
    if ((to === 'enviada' || to === 'negociacion' || to === 'ganada') && !cur.sent_at) patch.sent_at = new Date().toISOString()
    if (to === 'enviada' && !cur.valid_until) patch.valid_until = plusDays(DEFAULT_VALIDITY_DAYS)
    if (to === 'ganada' || to === 'perdida') patch.decided_at = new Date().toISOString()
    else patch.decided_at = null
    if (to === 'perdida') {
      patch.lost_reason = d.lostReason
      patch.lost_notes = d.lostNotes || null
    } else {
      patch.lost_reason = null
      patch.lost_notes = null
    }
  }
  if (d.quotedAmount != null && d.quotedAmount !== Number(cur.quoted_amount)) patch.quoted_amount = d.quotedAmount

  const { error } = await supabase.from('crm_quotes').update(patch).eq('id', cur.id)
  if (error) return { error: error.message }

  const company = Array.isArray(cur.company) ? cur.company[0]?.name : cur.company?.name
  if (patch.quoted_amount !== undefined) {
    await logEvent(supabase, cur.id, { kind: 'amount', body: null, metadata: { from: cur.quoted_amount, to: patch.quoted_amount } }, userId)
  }
  if (to !== from) {
    await logEvent(
      supabase,
      cur.id,
      { kind: 'stage', fromStage: from, toStage: to, body: to === 'perdida' ? [d.lostReason, d.lostNotes].filter(Boolean).join(' — ') : null },
      userId,
    )
    if (to === 'ganada' || to === 'perdida') {
      await logAudit({
        action: to === 'ganada' ? AUDIT_ACTIONS.crmQuoteWon : AUDIT_ACTIONS.crmQuoteLost,
        entityType: 'crm_quote',
        entityId: cur.id,
        entityLabel: `${quoteCode(Number(cur.number))} · ${company ?? ''}`,
        summary: `${quoteCode(Number(cur.number))} de ${company ?? '—'}: ${STAGE_LABELS[to]}`,
        metadata: { amount: quoted, lostReason: d.lostReason ?? null },
      })
    }
  }
  revalidateCrm()
  return { success: to !== from ? `Movida a ${STAGE_LABELS[to]}` : 'Guardado' }
}

// ---------------------------------------------------------------------------
// Editar datos
// ---------------------------------------------------------------------------

const optText = (max: number) => z.string().max(max).nullable()
const updateSchema = z.object({
  id: uuid,
  companyId: uuid,
  contactId: uuid.nullable(),
  serviceType: z.enum(['congelado', 'refrigerado', 'controlada', 'seco']).nullable(),
  loadType: z.enum(['completa', 'parcial']).nullable(),
  origin: optText(120),
  destination: optText(120),
  pallets: z.number().int().positive().max(500).nullable(),
  weightKg: z.number().positive().nullable(),
  loadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  frequency: z.enum(['unica', 'semanal', 'quincenal', 'mensual']).nullable(),
  description: optText(4000),
  quotedAmount: z.number().positive().nullable(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  nextFollowupAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
})

export type UpdateQuoteInput = z.infer<typeof updateSchema>

export async function updateQuote(input: UpdateQuoteInput): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    const { data: cur } = await supabase.from('crm_quotes').select('quoted_amount, company_id').eq('id', d.id).single()
    if (!cur) return { error: 'No se encontró la cotización' }

    const destinationProvince = provinceOf(d.destination) ?? null
    let suggested: number | null = null
    if (destinationProvince) {
      const { data: rate } = await supabase.from('crm_rates').select(RATE_COLUMNS).eq('province', destinationProvince).maybeSingle()
      suggested = suggestPrice(rate ? mapRate(rate) : null, d)?.amount ?? null
    }
    const { error } = await supabase
      .from('crm_quotes')
      .update({
        company_id: d.companyId,
        contact_id: d.contactId,
        service_type: d.serviceType,
        load_type: d.loadType,
        origin: d.origin || null,
        destination: d.destination || null,
        destination_province: destinationProvince,
        pallets: d.pallets,
        weight_kg: d.weightKg,
        load_date: d.loadDate,
        frequency: d.frequency,
        description: d.description || null,
        quoted_amount: d.quotedAmount,
        suggested_amount: suggested,
        valid_until: d.validUntil,
        next_followup_at: d.nextFollowupAt,
      })
      .eq('id', d.id)
    if (error) return { error: error.message }
    const prevAmount = cur.quoted_amount === null ? null : Number(cur.quoted_amount)
    if (prevAmount !== d.quotedAmount) {
      await logEvent(supabase, d.id, { kind: 'amount', metadata: { from: prevAmount, to: d.quotedAmount } }, userId)
    }
    if (cur.company_id !== d.companyId) {
      await logEvent(supabase, d.id, { kind: 'update', body: 'Se cambió la empresa' }, userId)
    }
    revalidateCrm()
    return { success: 'Cotización guardada' }
  } catch (e) {
    return fail(e, 'Error al guardar la cotización')
  }
}

export async function addQuoteNote(id: string, body: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const text = body.trim()
    if (!text) return { error: 'Escribí la nota' }
    if (!uuid.safeParse(id).success) return { error: 'Cotización inválida' }
    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    await logEvent(supabase, id, { kind: 'note', body: text.slice(0, 4000) }, userId)
    revalidateCrm()
    return { success: 'Nota agregada' }
  } catch (e) {
    return fail(e, 'Error al guardar la nota')
  }
}

/** Se mandó el precio por WhatsApp o mail: pasa a "Enviada" (si estaba antes) y registra el envío. */
export async function markQuoteSent(id: string, via: 'whatsapp' | 'email' | 'copy'): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(id).success) return { error: 'Cotización inválida' }
    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    const { data: cur } = await supabase
      .from('crm_quotes')
      .select('id, number, stage, quoted_amount, sent_at, valid_until, company:crm_companies!crm_quotes_company_id_fkey(name)')
      .eq('id', id)
      .single()
    if (!cur) return { error: 'No se encontró la cotización' }
    if (!cur.quoted_amount) return { error: 'Cargá el precio cotizado antes de enviarlo' }
    await logEvent(supabase, id, { kind: 'sent', body: via === 'whatsapp' ? 'Enviada por WhatsApp' : via === 'email' ? 'Enviada por mail' : 'Texto copiado para enviar', metadata: { via, amount: Number(cur.quoted_amount) } }, userId)
    const stage = cur.stage as CrmStage
    if (stage === 'nuevo' || stage === 'cotizando') {
      return await applyStage(supabase, userId, cur, stage, { id, stage: 'enviada', position: await topPosition(supabase, 'enviada') })
    }
    revalidateCrm()
    return { success: 'Envío registrado' }
  } catch (e) {
    return fail(e, 'Error al registrar el envío')
  }
}

export async function deleteQuote(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('crm_quotes')
      .update(softDeleteUpdate())
      .eq('id', id)
      .select('number, company:crm_companies!crm_quotes_company_id_fkey(name)')
      .single()
    if (error) return { error: error.message }
    const company = Array.isArray(data.company) ? data.company[0]?.name : (data.company as { name?: string } | null)?.name
    await logAudit({
      action: AUDIT_ACTIONS.crmQuoteDelete,
      entityType: 'crm_quote',
      entityId: id,
      summary: `Envió a la papelera ${quoteCode(Number(data.number))} de ${company ?? '—'}`,
    })
    revalidateCrm()
    return { success: 'Cotización enviada a la papelera' }
  } catch (e) {
    return fail(e, 'Error al borrar la cotización')
  }
}
