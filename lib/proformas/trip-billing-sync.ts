import type { SupabaseClient } from '@supabase/supabase-js'

type LineItem = { trip_id: string; amount: number }

/** Estado operativo por defecto al liberar un viaje de una proforma eliminada. */
const REVERT_TRIP_STATUS = 'sent'

export async function applyProformaLineItemsToTrips(
  supabase: SupabaseClient,
  lineItems: LineItem[],
  status: 'pending_payment' | 'paid'
) {
  for (const item of lineItems) {
    const { data: trip, error } = await supabase
      .from('trips')
      .select('total_expenses, total_pallets')
      .eq('id', item.trip_id)
      .single()

    if (error || !trip) continue

    const totalExpenses = Number(trip.total_expenses)
    const totalIncome = item.amount
    const totalPallets = trip.total_pallets != null ? Number(trip.total_pallets) : null
    const proformaUnitPrice =
      totalPallets != null && totalPallets > 0 ? totalIncome / totalPallets : null

    await supabase
      .from('trips')
      .update({
        status,
        total_income: totalIncome,
        proforma_unit_price: proformaUnitPrice,
        profit: totalIncome - totalExpenses,
      })
      .eq('id', item.trip_id)
  }
}

export async function revertTripsAfterProformaRemoved(
  supabase: SupabaseClient,
  tripIds: string[],
  options: { force?: boolean } = {}
) {
  for (const tripId of tripIds) {
    const { data: trip, error } = await supabase
      .from('trips')
      .select('total_expenses, status')
      .eq('id', tripId)
      .single()

    if (error || !trip) continue
    if (!options.force && trip.status === 'paid') continue

    const totalExpenses = Number(trip.total_expenses)

    await supabase
      .from('trips')
      .update({
        status: REVERT_TRIP_STATUS,
        total_income: 0,
        proforma_unit_price: null,
        profit: 0 - totalExpenses,
      })
      .eq('id', tripId)
  }
}

export async function loadProformaLineAmounts(
  supabase: SupabaseClient,
  proformaId: string
): Promise<LineItem[]> {
  const { data, error } = await supabase
    .from('proforma_line_items')
    .select('trip_id, amount')
    .eq('proforma_id', proformaId)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    trip_id: row.trip_id as string,
    amount: Number(row.amount),
  }))
}
