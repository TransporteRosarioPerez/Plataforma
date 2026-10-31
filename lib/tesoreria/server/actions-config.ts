'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import type { ActionState } from '@/lib/validations/parse-form'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { revalidateTreasury } from './revalidate'
import { isValidRulePattern } from '../engine'
import { isValidCuit, normalizeDescription, roundMoney } from '../text'

const uuid = z.string().uuid()
const scopeSchema = z.enum(['empresa', 'personal']).nullable()

function fail(e: unknown, fallback: string): ActionState {
  return { error: e instanceof Error ? e.message : fallback }
}

function friendly(message: string): string {
  if (message.includes('duplicate')) return 'Ya existe un registro con ese nombre o CUIT'
  return message
}

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

const accountSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(80),
  openingBalance: z.number().finite(),
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  isActive: z.boolean(),
})

export async function updateAccount(input: z.infer<typeof accountSchema>): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const parsed = accountSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    const supabase = await createClient()
    const { error } = await supabase
      .from('treasury_accounts')
      .update({
        name: d.name,
        opening_balance: roundMoney(d.openingBalance),
        opening_date: d.openingDate,
        is_active: d.isActive,
      })
      .eq('id', d.id)
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryAccountUpdate,
      entityType: 'treasury_account',
      entityId: d.id,
      summary: `Actualizó la cuenta ${d.name}`,
      metadata: { openingBalance: d.openingBalance, openingDate: d.openingDate, isActive: d.isActive },
    })
    revalidateTreasury()
    return { success: 'Cuenta actualizada' }
  } catch (e) {
    return fail(e, 'Error al guardar la cuenta')
  }
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  id: uuid.optional(),
  name: z.string().min(1, 'Nombre requerido').max(80),
  kind: z.enum(['income', 'expense', 'internal']),
  defaultScope: scopeSchema,
  isActive: z.boolean().default(true),
})

export async function upsertCategory(input: z.input<typeof categorySchema>): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const parsed = categorySchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    const payload = {
      name: d.name.trim(),
      kind: d.kind,
      default_scope: d.kind === 'internal' ? null : d.defaultScope,
      is_active: d.isActive,
    }
    const supabase = await createClient()
    const { data, error } = d.id
      ? await supabase.from('treasury_categories').update(payload).eq('id', d.id).select('id').single()
      : await supabase.from('treasury_categories').insert({ ...payload, sort_order: 100 }).select('id').single()
    if (error) return { error: friendly(error.message) }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryCategoryUpsert,
      entityType: 'treasury_category',
      entityId: data.id,
      summary: `${d.id ? 'Actualizó' : 'Creó'} la categoría ${d.name}`,
    })
    revalidateTreasury()
    return { success: 'Categoría guardada' }
  } catch (e) {
    return fail(e, 'Error al guardar la categoría')
  }
}

// ---------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------

const ruleSchema = z.object({
  id: uuid.optional(),
  name: z.string().min(1, 'Nombre requerido').max(120),
  matchType: z.enum(['contains', 'regex', 'cuit']),
  pattern: z.string().min(1, 'Patrón requerido').max(300),
  direction: z.enum(['any', 'in', 'out']),
  accountId: uuid.nullable(),
  categoryId: uuid,
  scope: scopeSchema,
  transferAccountId: uuid.nullable(),
  priority: z.number().int().min(0).max(1000),
})

export async function upsertRule(input: z.infer<typeof ruleSchema>): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const parsed = ruleSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    if (!isValidRulePattern(d.matchType, d.pattern)) {
      return {
        error:
          d.matchType === 'regex'
            ? 'La expresión regular no es válida'
            : d.matchType === 'cuit'
              ? 'El CUIT tiene que tener 11 dígitos'
              : 'Patrón inválido',
      }
    }
    const payload = {
      name: d.name.trim(),
      match_type: d.matchType,
      pattern: d.matchType === 'contains' ? normalizeDescription(d.pattern) : d.pattern.trim(),
      direction: d.direction,
      account_id: d.accountId,
      category_id: d.categoryId,
      scope: d.scope,
      transfer_account_id: d.transferAccountId,
      priority: d.priority,
    }
    const supabase = await createClient()
    const { data, error } = d.id
      ? await supabase.from('treasury_rules').update(payload).eq('id', d.id).select('id').single()
      : await supabase.from('treasury_rules').insert(payload).select('id').single()
    if (error) return { error: friendly(error.message) }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryRuleUpsert,
      entityType: 'treasury_rule',
      entityId: data.id,
      summary: `${d.id ? 'Actualizó' : 'Creó'} la regla ${d.name}`,
    })
    revalidateTreasury()
    return { success: 'Regla guardada' }
  } catch (e) {
    return fail(e, 'Error al guardar la regla')
  }
}

export async function toggleRule(id: string, isActive: boolean): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(id).success) return { error: 'Datos inválidos' }
    const supabase = await createClient()
    const { error } = await supabase.from('treasury_rules').update({ is_active: isActive }).eq('id', id)
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryRuleToggle,
      entityType: 'treasury_rule',
      entityId: id,
      summary: isActive ? 'Activó una regla' : 'Desactivó una regla',
    })
    revalidateTreasury()
    return { success: isActive ? 'Regla activada' : 'Regla desactivada' }
  } catch (e) {
    return fail(e, 'Error al actualizar la regla')
  }
}

// ---------------------------------------------------------------------------
// Contrapartes
// ---------------------------------------------------------------------------

const counterpartySchema = z.object({
  id: uuid.optional(),
  cuit: z.string().regex(/^\d{11}$/, 'El CUIT tiene que tener 11 dígitos, sin guiones'),
  name: z.string().min(1, 'Nombre requerido').max(120),
  categoryId: uuid.nullable(),
  scope: scopeSchema,
  notes: z.string().max(500).optional(),
})

export async function upsertCounterparty(input: z.infer<typeof counterpartySchema>): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const parsed = counterpartySchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    if (!isValidCuit(d.cuit)) return { error: 'El CUIT no es válido (dígito verificador)' }
    const payload = {
      cuit: d.cuit,
      name: d.name.trim(),
      category_id: d.categoryId,
      scope: d.scope,
      notes: d.notes || null,
    }
    const supabase = await createClient()
    const { data, error } = d.id
      ? await supabase.from('treasury_counterparties').update(payload).eq('id', d.id).select('id').single()
      : await supabase.from('treasury_counterparties').insert(payload).select('id').single()
    if (error) return { error: friendly(error.message) }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryCounterpartyUpsert,
      entityType: 'treasury_counterparty',
      entityId: data.id,
      summary: `${d.id ? 'Actualizó' : 'Agregó'} la contraparte ${d.name} (${d.cuit})`,
    })
    revalidateTreasury()
    return { success: 'Contraparte guardada' }
  } catch (e) {
    return fail(e, 'Error al guardar la contraparte')
  }
}

// ---------------------------------------------------------------------------
// Baja (soft delete). Se restaura desde la Papelera general de la plataforma.
// ---------------------------------------------------------------------------

const TRASHABLE = {
  category: { table: 'treasury_categories', entityType: 'treasury_category', label: 'la categoría' },
  rule: { table: 'treasury_rules', entityType: 'treasury_rule', label: 'la regla' },
  counterparty: { table: 'treasury_counterparties', entityType: 'treasury_counterparty', label: 'la contraparte' },
} as const

export type TrashableEntity = keyof typeof TRASHABLE

export async function deleteConfigItem(entity: TrashableEntity, id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const spec = TRASHABLE[entity]
    if (!spec || !uuid.safeParse(id).success) return { error: 'Datos inválidos' }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from(spec.table)
      .update(softDeleteUpdate())
      .eq('id', id)
      .select('name')
      .single()
    if (error) return { error: friendly(error.message) }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryConfigDelete,
      entityType: spec.entityType,
      entityId: id,
      entityLabel: data?.name ?? undefined,
      summary: `Envió a la papelera ${spec.label} ${data?.name ?? ''}`.trim(),
    })
    revalidateTreasury()
    revalidatePath('/app/papelera')
    return { success: 'Enviado a la papelera. Podés recuperarlo desde Papelera.' }
  } catch (e) {
    return fail(e, 'Error al borrar')
  }
}
