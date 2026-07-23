import type { SupabaseClient } from '@supabase/supabase-js'

type LineItem = { trip_id: string; amount: number }

/** Estado operativo por defecto al liberar un viaje sin proformas activas. */
const REVERT_TRIP_STATUS = 'sent'

/**
 * Recalcula ingreso y estado de cobranza de un viaje a partir de todas las
 * proformas activas que lo incluyen:
 * - total_income = suma de importes de línea
 * - paid solo si todas esas proformas están cobradas
 * - pending_payment si hay al menos una proforma activa no cobrada
 * - sent + income 0 si no queda ninguna
 */
export async function resyncTripBilling(supabase: SupabaseClient, tripId: string) {
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('total_expenses, total_pallets')
    .eq('id', tripId)
    .single()

  if (tripError || !trip) return

  const { data: lines, error: linesError } = await supabase
    .from('proforma_line_items')
    .select('amount, proforma_id')
    .eq('trip_id', tripId)

  if (linesError) throw new Error(linesError.message)

  const proformaIds = Array.from(
    new Set((lines ?? []).map((row) => row.proforma_id as string).filter(Boolean))
  )

  let activeByProforma = new Map<string, string>()
  if (proformaIds.length > 0) {
    const { data: proformas, error: proformasError } = await supabase
      .from('proformas')
      .select('id, status')
      .in('id', proformaIds)
      .is('deleted_at', null)

    if (proformasError) throw new Error(proformasError.message)

    activeByProforma = new Map(
      (proformas ?? []).map((row) => [row.id as string, row.status as string])
    )
  }

  const activeLines = (lines ?? []).filter((row) => activeByProforma.has(row.proforma_id as string))

  const totalExpenses = Number(trip.total_expenses)
  const totalPallets = trip.total_pallets != null ? Number(trip.total_pallets) : null

  if (activeLines.length === 0) {
    await supabase
      .from('trips')
      .update({
        status: REVERT_TRIP_STATUS,
        total_income: 0,
        proforma_unit_price: null,
        profit: 0 - totalExpenses,
      })
      .eq('id', tripId)
    return
  }

  const totalIncome = activeLines.reduce((sum, row) => sum + Number(row.amount), 0)
  const allCobradas = activeLines.every((row) => {
    const status = activeByProforma.get(row.proforma_id as string)
    return status === 'cobrada'
  })
  const status = allCobradas ? 'paid' : 'pending_payment'
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
    .eq('id', tripId)
}

export async function resyncTripsBilling(supabase: SupabaseClient, tripIds: string[]) {
  const unique = Array.from(new Set(tripIds.filter(Boolean)))
  for (const tripId of unique) {
    await resyncTripBilling(supabase, tripId)
  }
}

/** Status se calcula desde las proformas vinculadas (suma de importes). */
export async function applyProformaLineItemsToTrips(
  supabase: SupabaseClient,
  lineItems: LineItem[],
  _status?: 'pending_payment' | 'paid'
) {
  await resyncTripsBilling(
    supabase,
    lineItems.map((item) => item.trip_id)
  )
}

export async function revertTripsAfterProformaRemoved(
  supabase: SupabaseClient,
  tripIds: string[],
  _options: { force?: boolean } = {}
) {
  await resyncTripsBilling(supabase, tripIds)
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
