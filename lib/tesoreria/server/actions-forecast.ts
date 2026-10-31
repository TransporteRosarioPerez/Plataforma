'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import type { ActionState } from '@/lib/validations/parse-form'
import { revalidateTreasury } from './revalidate'
import { roundMoney } from '../text'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

const itemSchema = z.object({
  id: uuid.optional(),
  name: z.string().min(1, 'Nombre requerido').max(120),
  amount: z.number().finite().refine((n) => n !== 0, 'El monto no puede ser 0'),
  frequency: z.enum(['once', 'weekly', 'monthly']),
  startDate: isoDate,
  endDate: isoDate.nullable(),
  dayOfMonth: z.number().int().min(1).max(31).nullable(),
  accountId: uuid.nullable(),
  categoryId: uuid.nullable(),
  isActive: z.boolean(),
  notes: z.string().max(500).nullable(),
})

export type ForecastItemInput = z.infer<typeof itemSchema>

export async function upsertForecastItem(input: ForecastItemInput): Promise<ActionState> {
  try {
    const session = await requireSuperadmin()
    const parsed = itemSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    if (d.endDate && d.endDate < d.startDate) return { error: 'La fecha de fin es anterior al inicio' }
    const payload = {
      name: d.name.trim(),
      amount: roundMoney(d.amount),
      frequency: d.frequency,
      start_date: d.startDate,
      end_date: d.frequency === 'once' ? null : d.endDate,
      day_of_month: d.frequency === 'monthly' ? d.dayOfMonth ?? Number(d.startDate.slice(8, 10)) : null,
      account_id: d.accountId,
      category_id: d.categoryId,
      is_active: d.isActive,
      notes: d.notes?.trim() || null,
    }
    const supabase = await createClient()
    const { data, error } = d.id
      ? await supabase.from('treasury_forecast_items').update(payload).eq('id', d.id).select('id').single()
      : await supabase.from('treasury_forecast_items').insert({ ...payload, created_by: session.user.id }).select('id').single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryForecastUpsert,
      entityType: 'treasury_forecast_item',
      entityId: data.id,
      entityLabel: payload.name,
      summary: `${d.id ? 'Actualizó' : 'Agregó'} "${payload.name}" en la proyección`,
    })
    revalidateTreasury()
    return { success: 'Guardado en la proyección' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al guardar' }
  }
}

export async function deleteForecastItem(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(id).success) return { error: 'Datos inválidos' }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('treasury_forecast_items')
      .update(softDeleteUpdate())
      .eq('id', id)
      .select('name')
      .single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryForecastDelete,
      entityType: 'treasury_forecast_item',
      entityId: id,
      entityLabel: data.name,
      summary: `Envió a la papelera "${data.name}" de la proyección`,
    })
    revalidateTreasury()
    revalidatePath('/app/papelera')
    return { success: 'Enviado a la papelera' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al borrar' }
  }
}
