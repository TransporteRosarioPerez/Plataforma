'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
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
  await requireSession()
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
  } else {
    const { error } = await supabase.from('expense_categories').insert({
      code,
      name: parsed.data.name,
      is_default: false,
      is_active: true,
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/app/configuracion/gastos')
  return { success: 'Categoría guardada' }
}

export async function toggleExpenseCategory(id: string, isActive: boolean): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()
  const { error } = await supabase
    .from('expense_categories')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/app/configuracion/gastos')
  return { success: 'Actualizado' }
}

export async function deleteExpenseCategory(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()
  const { error } = await supabase
    .from('expense_categories')
    .update(softDeleteUpdate())
    .eq('id', id)
    .is('deleted_at', null)
  if (error) return { error: error.message }
  revalidatePath('/app/configuracion/gastos')
  revalidatePath('/app/papelera')
  return { success: 'Categoría dada de baja. Podés recuperarla desde Papelera.' }
}
