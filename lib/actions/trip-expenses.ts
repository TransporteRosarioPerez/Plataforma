'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { tripExpenseSchema } from '@/lib/validations/trip-expenses'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { recalculateTripTotals } from '@/lib/trip-totals'

function revalidateTripPaths(tripId: string) {
  revalidatePath('/app/viajes')
  revalidatePath(`/app/viajes/${tripId}`)
  revalidatePath('/app/reportes')
}

export async function upsertTripExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(tripExpenseSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()

  const { data: category, error: catError } = await supabase
    .from('expense_categories')
    .select('id, name, is_active')
    .eq('id', parsed.data.category_id)
    .is('deleted_at', null)
    .single()

  if (catError || !category) return { error: 'Categoría no encontrada' }
  if (!category.is_active) return { error: 'La categoría no está activa' }

  const row = {
    trip_id: parsed.data.trip_id,
    category_id: parsed.data.category_id,
    category_name: category.name,
    amount: parsed.data.amount,
    paid_by: parsed.data.paid_by,
    description: parsed.data.description || null,
    expense_date: parsed.data.expense_date,
  }

  if (parsed.data.id) {
    const { error } = await supabase.from('trip_expenses').update(row).eq('id', parsed.data.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('trip_expenses').insert(row)
    if (error) return { error: error.message }
  }

  const totals = await recalculateTripTotals(supabase, parsed.data.trip_id)
  if ('error' in totals) return { error: totals.error }

  revalidateTripPaths(parsed.data.trip_id)
  return { success: parsed.data.id ? 'Gasto actualizado' : 'Gasto registrado' }
}

export async function deleteTripExpense(id: string, tripId: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase
    .from('trip_expenses')
    .update(softDeleteUpdate())
    .eq('id', id)
    .is('deleted_at', null)
  if (error) return { error: error.message }

  const totals = await recalculateTripTotals(supabase, tripId)
  if ('error' in totals) return { error: totals.error }

  revalidateTripPaths(tripId)
  revalidatePath('/app/papelera')
  return { success: 'Gasto dado de baja. Podés recuperarlo desde Papelera.' }
}
