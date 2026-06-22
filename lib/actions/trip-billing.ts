'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { updateTripBillingSchema } from '@/lib/validations/trip-billing'

export async function updateTripBilling(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(updateTripBillingSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('total_expenses, status')
    .eq('id', parsed.data.trip_id)
    .single()

  if (tripError || !trip) return { error: 'Viaje no encontrado' }
  if (trip.status === 'paid') {
    return { error: 'No se puede modificar un viaje ya pagado' }
  }

  const totalExpenses = Number(trip.total_expenses)
  const profit = parsed.data.total_income - totalExpenses

  const update: Record<string, unknown> = {
    total_income: parsed.data.total_income,
    profit,
  }

  if (parsed.data.billing_status) {
    update.status = parsed.data.billing_status
  }

  const { error } = await supabase
    .from('trips')
    .update(update)
    .eq('id', parsed.data.trip_id)

  if (error) return { error: error.message }

  revalidatePath('/app/viajes')
  revalidatePath(`/app/viajes/${parsed.data.trip_id}`)
  return { success: 'Facturación actualizada' }
}
