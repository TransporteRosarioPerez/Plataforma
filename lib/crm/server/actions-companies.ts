'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import type { ActionState } from '@/lib/validations/parse-form'
import {
  cleanDisplayName,
  normalizeCompanyName,
  normalizeCuit,
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
} from '../normalize'
import { revalidateCrm } from './revalidate'
import { currentUserId, fail, friendly } from './shared'

const uuid = z.string().uuid()
const optText = (max: number) => z.string().max(max).nullable()

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

const companySchema = z.object({
  id: uuid.optional(),
  name: z.string().min(1, 'Nombre requerido').max(160),
  cuit: optText(20),
  emailDomain: optText(120),
  website: optText(200),
  industry: optText(80),
  city: optText(80),
  province: optText(80),
  notes: optText(4000),
})

export async function upsertCompany(input: z.infer<typeof companySchema>): Promise<ActionState & { id?: string }> {
  try {
    await requireSuperadmin()
    const parsed = companySchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    const name = cleanDisplayName(d.name)
    const norm = normalizeCompanyName(name)
    if (!norm) return { error: 'El nombre no es válido' }
    if (d.cuit && !normalizeCuit(d.cuit)) return { error: 'El CUIT no es válido' }
    if (d.emailDomain && !normalizeDomain(d.emailDomain)) return { error: 'El dominio no es válido (ej.: empresa.com.ar) o es una casilla genérica' }
    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    const row = {
      name,
      name_norm: norm,
      cuit: normalizeCuit(d.cuit),
      email_domain: normalizeDomain(d.emailDomain),
      website: d.website || null,
      industry: d.industry || null,
      city: d.city || null,
      province: d.province || null,
      notes: d.notes || null,
    }
    const res = d.id
      ? await supabase.from('crm_companies').update(row).eq('id', d.id).select('id').single()
      : await supabase.from('crm_companies').insert({ ...row, created_by: userId }).select('id').single()
    if (res.error) return { error: friendly(res.error.message) }
    await logAudit({
      action: AUDIT_ACTIONS.crmCompanyUpsert,
      entityType: 'crm_company',
      entityId: res.data.id as string,
      entityLabel: name,
      summary: `${d.id ? 'Actualizó' : 'Creó'} la empresa ${name} (CRM)`,
    })
    revalidateCrm()
    return { success: 'Empresa guardada', id: res.data.id as string }
  } catch (e) {
    return fail(e, 'Error al guardar la empresa')
  }
}

export async function deleteCompany(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const supabase = await createClient()
    const { count } = await supabase
      .from('crm_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)
      .is('deleted_at', null)
    if (count) return { error: `Tiene ${count} cotizaciones. Fusionala con otra empresa en lugar de borrarla.` }
    const { data, error } = await supabase.from('crm_companies').update(softDeleteUpdate()).eq('id', id).select('name').single()
    if (error) return { error: error.message }
    await logAudit({ action: AUDIT_ACTIONS.crmCompanyDelete, entityType: 'crm_company', entityId: id, entityLabel: data.name as string, summary: `Envió a la papelera la empresa ${data.name} (CRM)` })
    revalidateCrm()
    return { success: 'Empresa enviada a la papelera' }
  } catch (e) {
    return fail(e, 'Error al borrar la empresa')
  }
}

/**
 * Fusiona `sourceId` dentro de `targetId`: mueve cotizaciones, pedidos, contactos y alias,
 * guarda el nombre viejo como alias y manda la empresa vieja a la papelera.
 */
export async function mergeCompanies(sourceId: string, targetId: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(sourceId).success || !uuid.safeParse(targetId).success) return { error: 'Empresas inválidas' }
    if (sourceId === targetId) return { error: 'Elegí dos empresas distintas' }
    const supabase = await createClient()
    const userId = await currentUserId(supabase)
    const [{ data: src }, { data: dst }] = await Promise.all([
      supabase.from('crm_companies').select('id, name, name_norm, cuit, email_domain, website, industry, city, province, notes').eq('id', sourceId).is('deleted_at', null).single(),
      supabase.from('crm_companies').select('id, name, name_norm, cuit, email_domain, website, industry, city, province, notes').eq('id', targetId).is('deleted_at', null).single(),
    ])
    if (!src || !dst) return { error: 'No se encontró alguna de las empresas' }

    // 1. Baja de la vieja primero (libera nombre/CUIT únicos)
    const del = await supabase.from('crm_companies').update({ ...softDeleteUpdate(), merged_into_id: targetId }).eq('id', sourceId)
    if (del.error) return { error: del.error.message }

    // 2. Mover todo
    const moves = await Promise.all([
      supabase.from('crm_quotes').update({ company_id: targetId }).eq('company_id', sourceId),
      supabase.from('crm_inbound_requests').update({ company_id: targetId }).eq('company_id', sourceId),
      supabase.from('crm_contacts').update({ company_id: targetId }).eq('company_id', sourceId),
      supabase.from('crm_company_aliases').update({ company_id: targetId }).eq('company_id', sourceId),
    ])
    const moveErr = moves.find((m) => m.error)?.error
    if (moveErr) return { error: moveErr.message }

    // 3. El nombre viejo queda como alias
    if (src.name_norm !== dst.name_norm) {
      await supabase
        .from('crm_company_aliases')
        .upsert({ company_id: targetId, alias: src.name, alias_norm: src.name_norm, source: 'merge', created_by: userId }, { onConflict: 'alias_norm' })
    }

    // 4. Completar datos que le falten a la que queda
    const patch: Record<string, unknown> = {}
    for (const k of ['cuit', 'email_domain', 'website', 'industry', 'city', 'province'] as const) {
      if (!dst[k] && src[k]) patch[k] = src[k]
    }
    if (src.notes) patch.notes = [dst.notes, src.notes].filter(Boolean).join('\n\n')
    if (Object.keys(patch).length) await supabase.from('crm_companies').update(patch).eq('id', targetId)

    await logAudit({
      action: AUDIT_ACTIONS.crmCompanyMerge,
      entityType: 'crm_company',
      entityId: targetId,
      entityLabel: dst.name as string,
      summary: `Fusionó "${src.name}" dentro de "${dst.name}" (CRM)`,
      metadata: { sourceId, targetId },
    })
    revalidateCrm()
    return { success: `"${src.name}" quedó fusionada en "${dst.name}"` }
  } catch (e) {
    return fail(e, 'Error al fusionar')
  }
}

// ---------------------------------------------------------------------------
// Alias
// ---------------------------------------------------------------------------

export async function addAlias(companyId: string, alias: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const text = cleanDisplayName(alias)
    const norm = normalizeCompanyName(text)
    if (!norm) return { error: 'Alias inválido' }
    const supabase = await createClient()
    const { data: company } = await supabase.from('crm_companies').select('name_norm').eq('id', companyId).single()
    if (company?.name_norm === norm) return { error: 'Es igual al nombre de la empresa' }
    const { data: other } = await supabase.from('crm_companies').select('name').eq('name_norm', norm).is('deleted_at', null).maybeSingle()
    if (other) return { error: `"${other.name}" es otra empresa. Si son la misma, fusionalas.` }
    const userId = await currentUserId(supabase)
    const { error } = await supabase.from('crm_company_aliases').insert({ company_id: companyId, alias: text, alias_norm: norm, source: 'manual', created_by: userId })
    if (error) return { error: friendly(error.message) }
    revalidateCrm()
    return { success: 'Alias agregado' }
  } catch (e) {
    return fail(e, 'Error al agregar el alias')
  }
}

export async function removeAlias(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const supabase = await createClient()
    const { error } = await supabase.from('crm_company_aliases').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidateCrm()
    return { success: 'Alias quitado' }
  } catch (e) {
    return fail(e, 'Error al quitar el alias')
  }
}

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------

const contactSchema = z.object({
  id: uuid.optional(),
  companyId: uuid,
  name: optText(120),
  email: optText(200),
  phone: optText(40),
  role: optText(80),
})

export async function upsertContact(input: z.infer<typeof contactSchema>): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    if (!d.name && !d.email && !d.phone) return { error: 'Completá al menos nombre, mail o teléfono' }
    if (d.email && !normalizeEmail(d.email)) return { error: 'El mail no es válido' }
    const row = {
      company_id: d.companyId,
      name: d.name || null,
      email: normalizeEmail(d.email),
      phone: d.phone || null,
      phone_norm: normalizePhone(d.phone),
      role: d.role || null,
    }
    const supabase = await createClient()
    const { error } = d.id
      ? await supabase.from('crm_contacts').update(row).eq('id', d.id)
      : await supabase.from('crm_contacts').insert(row)
    if (error) return { error: error.message }
    revalidateCrm()
    return { success: 'Contacto guardado' }
  } catch (e) {
    return fail(e, 'Error al guardar el contacto')
  }
}

export async function deleteContact(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const supabase = await createClient()
    const { error } = await supabase.from('crm_contacts').update(softDeleteUpdate()).eq('id', id)
    if (error) return { error: error.message }
    revalidateCrm()
    return { success: 'Contacto eliminado' }
  } catch (e) {
    return fail(e, 'Error al eliminar el contacto')
  }
}

// ---------------------------------------------------------------------------
// Tarifario
// ---------------------------------------------------------------------------

const rateSchema = z.object({
  id: uuid.optional(),
  province: z.string().min(1).max(80),
  pricePerPallet: z.number().nonnegative().nullable(),
  priceFullTruck: z.number().nonnegative().nullable(),
  frozenSurchargePct: z.number().min(0).max(200),
  notes: optText(500),
  isActive: z.boolean(),
})

export async function upsertRate(input: z.infer<typeof rateSchema>): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const parsed = rateSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    const row = {
      province: d.province.trim(),
      price_per_pallet: d.pricePerPallet || null,
      price_full_truck: d.priceFullTruck || null,
      frozen_surcharge_pct: d.frozenSurchargePct,
      notes: d.notes || null,
      is_active: d.isActive,
    }
    const supabase = await createClient()
    const { error } = d.id
      ? await supabase.from('crm_rates').update(row).eq('id', d.id)
      : await supabase.from('crm_rates').insert(row)
    if (error) return { error: friendly(error.message) }
    await logAudit({ action: AUDIT_ACTIONS.crmRateUpsert, entityType: 'crm_rate', entityLabel: row.province, summary: `Actualizó la tarifa a ${row.province} (CRM)`, metadata: row })
    revalidateCrm()
    return { success: 'Tarifa guardada' }
  } catch (e) {
    return fail(e, 'Error al guardar la tarifa')
  }
}
