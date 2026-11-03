'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import type { ActionState } from '@/lib/validations/parse-form'
import { cleanDisplayName, normalizeCompanyName, normalizeEmail } from '../normalize'
import {
  BLOCKED_STATUSES,
  csvToProspects,
  prospectNameNorm,
  routeForProvince,
  routeFromText,
  type ProspectStatus,
} from '../prospecting'
import { mapRoute } from './data-prospects'
import { runOutreach } from './outreach'
import { revalidateCrm } from './revalidate'
import { currentUserId, fail, friendly } from './shared'

const uuid = z.string().uuid()
const optText = (max: number) => z.string().max(max).nullable().optional()

function friendlyProspect(message: string): string {
  if (message.includes('crm_prospects_email_key')) return 'Ya hay un prospecto con ese mail'
  if (message.includes('crm_outreach_one_open_key')) return 'Ese prospecto ya tiene una secuencia en curso'
  return friendly(message)
}

async function linkCompany(supabase: Awaited<ReturnType<typeof createClient>>, name: string): Promise<string | null> {
  const norm = normalizeCompanyName(name)
  if (!norm) return null
  const { data } = await supabase.from('crm_companies').select('id').eq('name_norm', norm).is('deleted_at', null).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

// ---------------------------------------------------------------------------
// Prospectos
// ---------------------------------------------------------------------------

const prospectSchema = z.object({
  id: uuid.optional(),
  companyName: z.string().min(1, 'Nombre requerido').max(160),
  routeKey: optText(40),
  province: optText(80),
  city: optText(80),
  products: optText(300),
  contactName: optText(120),
  contactRole: optText(120),
  email: optText(200),
  phone: optText(60),
  website: optText(200),
  priority: z.enum(['alta', 'media', 'baja']),
  hook: optText(500),
  source: optText(200),
  sourceUrl: optText(500),
  notes: optText(4000),
  status: z.enum(['nuevo', 'en_secuencia', 'respondio', 'cotizando', 'ganado', 'perdido', 'sin_respuesta', 'baja', 'rebotado']).optional(),
})

export async function upsertProspect(input: z.infer<typeof prospectSchema>): Promise<ActionState & { id?: string }> {
  try {
    await requireSuperadmin()
    const parsed = prospectSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    const email = d.email ? normalizeEmail(d.email) : null
    if (d.email && !email) return { error: 'El mail no es válido' }
    const supabase = await createClient()
    const name = cleanDisplayName(d.companyName)
    const row = {
      company_name: name,
      name_norm: prospectNameNorm(name),
      company_id: await linkCompany(supabase, name),
      route_key: d.routeKey || null,
      province: d.province || null,
      city: d.city || null,
      products: d.products || null,
      contact_name: d.contactName || null,
      contact_role: d.contactRole || null,
      email,
      phone: d.phone || null,
      website: d.website || null,
      priority: d.priority,
      hook: d.hook || null,
      source: d.source || null,
      source_url: d.sourceUrl || null,
      notes: d.notes || null,
      ...(d.status ? { status: d.status } : {}),
    }
    const res = d.id
      ? await supabase.from('crm_prospects').update(row).eq('id', d.id).select('id').single()
      : await supabase.from('crm_prospects').insert({ ...row, created_by: await currentUserId(supabase) }).select('id').single()
    if (res.error) return { error: friendlyProspect(res.error.message) }
    await logAudit({
      action: AUDIT_ACTIONS.crmProspectUpsert,
      entityType: 'crm_prospect',
      entityId: res.data.id as string,
      entityLabel: name,
      summary: `${d.id ? 'Actualizó' : 'Cargó'} el prospecto ${name}`,
    })
    revalidateCrm()
    return { success: 'Prospecto guardado', id: res.data.id as string }
  } catch (e) {
    return fail(e, 'Error al guardar el prospecto')
  }
}

export async function importProspects(csv: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (csv.length > 2_000_000) return { error: 'El archivo es muy grande (máx. 2 MB)' }
    const { rows, errors } = csvToProspects(csv)
    if (!rows.length) return { error: errors[0] ?? 'No hay filas para importar' }
    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    const [{ data: routesRaw }, { data: existing }, { data: companies }] = await Promise.all([
      supabase.from('crm_outreach_routes').select('*'),
      supabase.from('crm_prospects').select('email, name_norm').is('deleted_at', null),
      supabase.from('crm_companies').select('id, name_norm').is('deleted_at', null),
    ])
    const routes = (routesRaw ?? []).map(mapRoute)
    const emails = new Set((existing ?? []).map((p) => p.email?.toLowerCase()).filter(Boolean))
    const names = new Set((existing ?? []).map((p) => p.name_norm))
    const companyByNorm = new Map((companies ?? []).map((c) => [c.name_norm as string, c.id as string]))

    let dup = 0
    const toInsert = []
    for (const r of rows) {
      const norm = prospectNameNorm(r.companyName)
      if ((r.email && emails.has(r.email)) || (!r.email && names.has(norm))) { dup++; continue }
      if (r.email) emails.add(r.email)
      names.add(norm)
      const firstProvince = r.province?.split('/')[0]?.trim() || null
      toInsert.push({
        company_name: cleanDisplayName(r.companyName),
        name_norm: norm,
        company_id: companyByNorm.get(normalizeCompanyName(r.companyName)) ?? null,
        route_key: routeFromText(r.route, routes) ?? routeForProvince(firstProvince, routes),
        province: firstProvince,
        city: r.city,
        products: r.products,
        contact_name: r.contactName,
        contact_role: r.contactRole,
        email: r.email,
        phone: r.phone,
        website: r.website,
        priority: r.priority,
        hook: r.hook,
        source: r.source,
        source_url: r.sourceUrl,
        notes: r.notes,
        created_by: userId,
      })
    }
    if (toInsert.length) {
      const { error } = await supabase.from('crm_prospects').insert(toInsert)
      if (error) return { error: friendlyProspect(error.message) }
    }
    const noEmail = toInsert.filter((r) => !r.email).length
    await logAudit({
      action: AUDIT_ACTIONS.crmProspectImport,
      entityType: 'crm_prospect',
      summary: `Importó ${toInsert.length} prospectos (${dup} repetidos)`,
      metadata: { imported: toInsert.length, duplicates: dup, errors: errors.slice(0, 20) },
    })
    revalidateCrm()
    const parts = [`${toInsert.length} importados`]
    if (dup) parts.push(`${dup} ya estaban`)
    if (noEmail) parts.push(`${noEmail} sin mail`)
    if (errors.length) parts.push(`${errors.length} con problemas`)
    return { success: parts.join(' · ') }
  } catch (e) {
    return fail(e, 'Error al importar')
  }
}

export async function deleteProspects(ids: string[]): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const list = z.array(uuid).min(1).max(1000).parse(ids)
    const supabase = await createClient()
    await supabase.from('crm_outreach').update({ status: 'cancelada', next_send_at: null }).in('prospect_id', list).in('status', ['activa', 'pausada'])
    const { error } = await supabase.from('crm_prospects').update({ deleted_at: new Date().toISOString() }).in('id', list)
    if (error) return { error: error.message }
    await logAudit({ action: AUDIT_ACTIONS.crmProspectDelete, entityType: 'crm_prospect', summary: `Eliminó ${list.length} prospectos` })
    revalidateCrm()
    return { success: `${list.length} eliminados` }
  } catch (e) {
    return fail(e, 'Error al eliminar')
  }
}

export async function setProspectsStatus(ids: string[], status: ProspectStatus): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const list = z.array(uuid).min(1).max(1000).parse(ids)
    const st = prospectSchema.shape.status.unwrap().parse(status)
    const supabase = await createClient()
    const { error } = await supabase.from('crm_prospects').update({ status: st }).in('id', list)
    if (error) return { error: error.message }
    // Si se marca como ganado/perdido/baja, se cortan las secuencias
    if (['ganado', 'perdido', 'baja', 'cotizando', 'respondio'].includes(st)) {
      await supabase.from('crm_outreach').update({ status: 'cancelada', next_send_at: null }).in('prospect_id', list).in('status', ['activa', 'pausada'])
    }
    if (st === 'baja') {
      const { data } = await supabase.from('crm_prospects').select('email').in('id', list).not('email', 'is', null)
      if (data?.length) await supabase.from('crm_email_suppressions').upsert(data.map((p) => ({ email: String(p.email).toLowerCase(), reason: 'manual', source: 'crm' })), { onConflict: 'email' })
    }
    revalidateCrm()
    return { success: 'Estado actualizado' }
  } catch (e) {
    return fail(e, 'Error al cambiar el estado')
  }
}

// ---------------------------------------------------------------------------
// Secuencias
// ---------------------------------------------------------------------------

export async function startSequence(ids: string[]): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const list = z.array(uuid).min(1).max(500).parse(ids)
    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    const [{ data: prospects }, { data: open }, { data: tpl }] = await Promise.all([
      supabase.from('crm_prospects').select('id, email, status').in('id', list).is('deleted_at', null),
      supabase.from('crm_outreach').select('prospect_id').in('prospect_id', list).in('status', ['activa', 'pausada']),
      supabase.from('crm_outreach_templates').select('id').eq('sequence', 'vuelta').eq('step', 1).eq('is_active', true).maybeSingle(),
    ])
    if (!tpl) return { error: 'Falta la plantilla del primer mail (Prospectos → Plantillas)' }
    const emails = (prospects ?? []).map((p) => p.email?.toLowerCase()).filter(Boolean) as string[]
    const { data: supp } = emails.length ? await supabase.from('crm_email_suppressions').select('email').in('email', emails) : { data: [] }
    const suppressed = new Set((supp ?? []).map((s) => s.email))
    const openSet = new Set((open ?? []).map((o) => o.prospect_id))

    const skipped = { noEmail: 0, blocked: 0, open: 0 }
    const rows = []
    const now = new Date().toISOString()
    for (const p of prospects ?? []) {
      if (!p.email) { skipped.noEmail++; continue }
      if (suppressed.has(p.email.toLowerCase()) || BLOCKED_STATUSES.includes(p.status)) { skipped.blocked++; continue }
      if (openSet.has(p.id)) { skipped.open++; continue }
      rows.push({ prospect_id: p.id, sequence: 'vuelta', to_email: p.email.toLowerCase(), next_step: 1, next_send_at: now, created_by: userId })
    }
    if (rows.length) {
      const { error } = await supabase.from('crm_outreach').insert(rows)
      if (error) return { error: friendlyProspect(error.message) }
      await supabase.from('crm_prospects').update({ status: 'en_secuencia' }).in('id', rows.map((r) => r.prospect_id)).in('status', ['nuevo', 'sin_respuesta', 'perdido'])
    }
    await logAudit({
      action: AUDIT_ACTIONS.crmOutreachStart,
      entityType: 'crm_prospect',
      summary: `Puso ${rows.length} prospectos en la secuencia de vuelta`,
      metadata: skipped,
    })
    revalidateCrm()
    if (!rows.length) return { error: 'Ninguno quedó en cola: sin mail, con baja o ya en secuencia' }
    const extra = [
      skipped.noEmail && `${skipped.noEmail} sin mail`,
      skipped.blocked && `${skipped.blocked} con baja/rebote/ganados`,
      skipped.open && `${skipped.open} ya estaban en secuencia`,
    ].filter(Boolean)
    return { success: `${rows.length} en cola${extra.length ? ` (salteados: ${extra.join(', ')})` : ''}` }
  } catch (e) {
    return fail(e, 'Error al iniciar la secuencia')
  }
}

export async function setSequencesPaused(ids: string[], paused: boolean): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const list = z.array(uuid).min(1).max(1000).parse(ids)
    const supabase = await createClient()
    const { error } = paused
      ? await supabase.from('crm_outreach').update({ status: 'pausada' }).in('prospect_id', list).eq('status', 'activa')
      : await supabase.from('crm_outreach').update({ status: 'activa', next_send_at: new Date().toISOString() }).in('prospect_id', list).eq('status', 'pausada')
    if (error) return { error: error.message }
    revalidateCrm()
    return { success: paused ? 'Secuencias pausadas' : 'Secuencias reanudadas' }
  } catch (e) {
    return fail(e, 'Error al actualizar las secuencias')
  }
}

export async function syncOutreachNow(): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const r = await runOutreach()
    revalidateCrm()
    if (!r.ok) return { error: r.reason ?? 'No se pudo sincronizar' }
    const parts = [`${r.sent} enviados`, `${r.replies} respuestas nuevas`]
    if (r.negatives) parts.push(`${r.negatives} bajas`)
    if (r.bounces) parts.push(`${r.bounces} rebotes`)
    if (r.failed) parts.push(`${r.failed} con error`)
    if (r.outsideWindow) parts.push('fuera del horario de envío: se manda en el próximo horario hábil')
    return { success: parts.join(' · ') }
  } catch (e) {
    return fail(e, 'Error al sincronizar')
  }
}

// ---------------------------------------------------------------------------
// Ajustes: casilla, plantillas, rutas
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  senderName: z.string().min(2).max(80),
  signature: z.string().min(2).max(600),
  dailyLimit: z.coerce.number().int().min(1).max(200),
  sendHourFrom: z.coerce.number().int().min(0).max(23),
  sendHourTo: z.coerce.number().int().min(1).max(24),
  weekdaysOnly: z.boolean(),
})

export async function updateGmailSettings(input: z.infer<typeof settingsSchema>): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const d = settingsSchema.parse(input)
    if (d.sendHourTo <= d.sendHourFrom) return { error: 'El horario de fin tiene que ser después del de inicio' }
    const { error } = await createServiceRoleClient().from('crm_gmail_connection').update({
      sender_name: d.senderName, signature: d.signature, daily_limit: d.dailyLimit,
      send_hour_from: d.sendHourFrom, send_hour_to: d.sendHourTo, weekdays_only: d.weekdaysOnly,
    }).eq('id', 1)
    if (error) return { error: error.message }
    revalidateCrm()
    return { success: 'Ajustes guardados' }
  } catch (e) {
    return fail(e, 'Error al guardar los ajustes')
  }
}

export async function disconnectGmail(): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const db = createServiceRoleClient()
    await db.from('crm_outreach').update({ status: 'pausada' }).eq('status', 'activa')
    const { error } = await db.from('crm_gmail_connection').delete().eq('id', 1)
    if (error) return { error: error.message }
    revalidateCrm()
    return { success: 'Gmail desconectado. Las secuencias quedaron pausadas.' }
  } catch (e) {
    return fail(e, 'Error al desconectar')
  }
}

const templateSchema = z.object({
  id: uuid,
  subject: z.string().max(200),
  body: z.string().min(10, 'El mail está vacío').max(5000),
  delayDays: z.coerce.number().int().min(0).max(90),
  isActive: z.boolean(),
})

export async function saveOutreachTemplate(input: z.infer<typeof templateSchema>): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const d = templateSchema.parse(input)
    const supabase = await createClient()
    const { data: cur } = await supabase.from('crm_outreach_templates').select('step').eq('id', d.id).single()
    if (cur?.step === 1 && !d.subject.trim()) return { error: 'El primer mail necesita asunto' }
    if (cur?.step === 1 && d.delayDays !== 0) return { error: 'El primer mail sale el día 0' }
    const { error } = await supabase.from('crm_outreach_templates').update({
      subject: d.subject, body: d.body, delay_days: d.delayDays, is_active: cur?.step === 1 ? true : d.isActive,
    }).eq('id', d.id)
    if (error) return { error: error.message }
    await logAudit({ action: AUDIT_ACTIONS.crmOutreachTemplate, summary: `Editó el mail ${cur?.step ?? ''} de la secuencia de vuelta` })
    revalidateCrm()
    return { success: 'Plantilla guardada' }
  } catch (e) {
    return fail(e, 'Error al guardar la plantilla')
  }
}

export async function saveOutreachRoute(input: { key: string; returnDay: string | null }): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const d = z.object({ key: z.string().min(1).max(40), returnDay: z.string().max(80).nullable() }).parse(input)
    const supabase = await createClient()
    const { error } = await supabase.from('crm_outreach_routes').update({ return_day: d.returnDay?.trim() || null }).eq('key', d.key)
    if (error) return { error: error.message }
    revalidateCrm()
    return { success: 'Ruta guardada' }
  } catch (e) {
    return fail(e, 'Error al guardar la ruta')
  }
}
