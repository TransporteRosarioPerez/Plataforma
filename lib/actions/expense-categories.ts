'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nombre requerido'),
  is_active: z.enum(['true', 'false']).optional(),
})

export async function upsertExpenseCategory(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin()
  const parsed = parseForm(schema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()
  const code = parsed.data.name.toLowerCase().replace(/\s+/g, '_').slice(0, 40)

  if (parsed.data.id) {
    const { error } = await supabase
      .from('expense_categories')
      .update({
        name: parsed.data.name,
        ...(parsed.data.is_active !== undefined && {
          is_active: parsed.data.is_active === 'true',
        }),
      })
      .eq('id', parsed.data.id)
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.expenseCategoryUpsert,
      entityType: 'expense_category',
      entityId: parsed.data.id,
      entityLabel: parsed.data.name,
      summary: `Actualizó la categoría ${parsed.data.name}`,
    })
  } else {
    const { data, error } = await supabase.from('expense_categories').insert({
      code,
      name: parsed.data.name,
      is_default: false,
      is_active: true,
    }).select('id').single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.expenseCategoryUpsert,
      entityType: 'expense_category',
      entityId: data.id,
      entityLabel: parsed.data.name,
      summary: `Creó la categoría ${parsed.data.name}`,
    })
  }

  revalidatePath('/app/configuracion/gastos')
  return { success: 'Categoría guardada' }
}

export async function toggleExpenseCategory(id: string, isActive: boolean): Promise<ActionState> {
  await requireSuperadmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from('expense_categories')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.expenseCategoryToggle,
    entityType: 'expense_category',
    entityId: id,
    summary: isActive ? 'Activó una categoría de gasto' : 'Desactivó una categoría de gasto',
    metadata: { isActive },
  })

  revalidatePath('/app/configuracion/gastos')
  return { success: 'Actualizado' }
}

export async function deleteExpenseCategory(id: string): Promise<ActionState> {
  await requireSuperadmin()
  const supabase = await createClient()

  const { data: category } = await supabase.from('expense_categories').select('name').eq('id', id).single()

  const { error } = await supabase
    .from('expense_categories')
    .update(softDeleteUpdate())
    .eq('id', id)
    .is('deleted_at', null)
  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.expenseCategoryDelete,
    entityType: 'expense_category',
    entityId: id,
    entityLabel: category?.name ?? undefined,
    summary: `Eliminó la categoría ${category?.name ?? id}`,
  })

  revalidatePath('/app/configuracion/gastos')
  revalidatePath('/app/papelera')
  return { success: 'Categoría dada de baja. Podés recuperarla desde Papelera.' }
}
