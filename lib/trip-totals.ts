import type { SupabaseClient } from '@supabase/supabase-js'

export async function recalculateTripTotals(
  supabase: SupabaseClient,
  tripId: string
): Promise<{ totalExpenses: number; profit: number } | { error: string }> {
  const { data: expenses, error: expError } = await supabase
    .from('trip_expenses')
    .select('amount')
    .eq('trip_id', tripId)
    .is('deleted_at', null)

  if (expError) return { error: expError.message }

  const { data: fuelRows, error: fuelError } = await supabase
    .from('fuel_transactions')
    .select('amount_total')
    .eq('trip_id', tripId)
    .eq('match_status', 'linked')
    .is('deleted_at', null)

  if (fuelError) return { error: fuelError.message }

  const expenseTotal = (expenses ?? []).reduce((sum, row) => sum + Number(row.amount), 0)
  const fuelTotal = (fuelRows ?? []).reduce((sum, row) => sum + Number(row.amount_total), 0)
  const totalExpenses = expenseTotal + fuelTotal

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('total_income')
    .eq('id', tripId)
    .single()

  if (tripError || !trip) return { error: 'Viaje no encontrado' }

  const totalIncome = Number(trip.total_income)
  const profit = totalIncome - totalExpenses

  const { error: updateError } = await supabase
    .from('trips')
    .update({ total_expenses: totalExpenses, profit })
    .eq('id', tripId)

  if (updateError) return { error: updateError.message }

  return { totalExpenses, profit }
}
