'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { fuelLoadSchema } from '@/lib/validations/fuel'
import { getTripsForFuelMatching } from '@/lib/data/fuel-transactions'
import { matchFuelRowToTrips } from '@/lib/fuel/matcher'
import { normalizePlate } from '@/lib/fuel/resolve'
import { recalculateTripTotals } from '@/lib/trip-totals'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'

function revalidateFuelPaths(...tripIds: (string | null | undefined)[]) {
  revalidatePath('/app/combustible')
  revalidatePath('/app/viajes')
  revalidatePath('/app/reportes')
  for (const id of tripIds) if (id) revalidatePath(`/app/viajes/${id}`)
}

/** Fecha de la planilla → mediodía en Argentina (evita que caiga en el día anterior por zona horaria). */
function loadDateToTimestamp(date: string): string {
  return new Date(`${date}T12:00:00-03:00`).toISOString()
}

export async function upsertFuelLoad(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const parsed = parseForm(fuelLoadSchema, formData)
  if (!parsed.success) return { error: parsed.error }
  const input = parsed.data

  const supabase = await createClient()

  const { data: vehicle, error: vErr } = await supabase
    .from('vehicles')
    .select('id, plate')
    .eq('id', input.vehicle_id)
    .is('deleted_at', null)
    .single()
  if (vErr || !vehicle) return { error: 'Vehículo no encontrado' }
  const plate = vehicle.plate as string

  let driverId: string | null = null
  let driverName: string | null = null
  if (input.driver_id) {
    const { data: driver, error: dErr } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('id', input.driver_id)
      .is('deleted_at', null)
      .single()
    if (dErr || !driver) return { error: 'Chofer no encontrado' }
    driverId = driver.id as string
    driverName = driver.name as string
  }

  const transactionAt = loadDateToTimestamp(input.load_date)
  const amountTotal = input.amount_total ?? 0

  // Si se edita y el viaje se había elegido a mano, se respeta.
  let previousTripId: string | null = null
  let keepManualTrip = false
  if (input.id) {
    const { data: prev, error } = await supabase
      .from('fuel_transactions')
      .select('trip_id, match_method, provider')
      .eq('id', input.id)
      .is('deleted_at', null)
      .single()
    if (error || !prev) return { error: 'Carga no encontrada' }
    previousTripId = prev.trip_id as string | null
    keepManualTrip = prev.match_method === 'manual' && !!prev.trip_id
  }

  let tripFields: Record<string, unknown> = {}
  if (!keepManualTrip) {
    const trips = await getTripsForFuelMatching()
    const match = matchFuelRowToTrips({ plate, transactionAt: new Date(transactionAt) }, trips)
    tripFields = {
      trip_id: match.status === 'linked' ? match.tripId : null,
      matched_plate_role: match.status === 'linked' ? match.matchedPlateRole : null,
      match_status: match.status,
      match_method: match.status === 'linked' ? 'auto' : null,
    }
  }

  const row = {
    transaction_at: transactionAt,
    plate,
    vehicle_id: vehicle.id,
    driver_id: driverId,
    driver_name: driverName,
    liters: input.liters,
    amount_total: amountTotal,
    amount_net: amountTotal,
    amount_taxes: 0,
    unit_price_pvp: amountTotal > 0 ? Math.round((amountTotal / input.liters) * 100) / 100 : null,
    odometer_km: input.odometer_km ?? null,
    payment_method: input.payment_method || null,
    station_name: input.station_name || null,
    ticket_number: input.ticket_number || null,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
    ...tripFields,
  }

  let id = input.id
  if (id) {
    const { error } = await supabase.from('fuel_transactions').update(row).eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await supabase
      .from('fuel_transactions')
      .insert({
        ...row,
        provider: 'manual',
        external_id: crypto.randomUUID(),
        product: 'Gasoil',
        product_kind: 'diesel',
        created_by: session.user.id,
      })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'No se pudo guardar la carga' }
    id = data.id as string
  }

  const newTripId = (tripFields.trip_id as string | null | undefined) ?? (keepManualTrip ? previousTripId : null)
  for (const tripId of new Set([previousTripId, newTripId])) {
    if (tripId) await recalculateTripTotals(supabase, tripId)
  }

  await logAudit({
    action: AUDIT_ACTIONS.fuelUpsert,
    entityType: 'fuel_transaction',
    entityId: id,
    summary: input.id ? `Editó la carga de combustible de ${plate}` : `Cargó ${input.liters} L de combustible a ${plate}`,
    metadata: { plate, liters: input.liters, amountTotal, date: input.load_date, tripId: newTripId },
  })

  revalidateFuelPaths(previousTripId, newTripId)

  const base = input.id ? 'Carga actualizada' : `Carga registrada para ${plate}`
  return { success: amountTotal <= 0 ? `${base} (quedó sin precio)` : base }
}

export async function linkFuelToTrip(fuelTransactionId: string, tripId: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: fuel, error: fuelError } = await supabase
    .from('fuel_transactions')
    .select('id, plate, trip_id')
    .eq('id', fuelTransactionId)
    .is('deleted_at', null)
    .single()
  if (fuelError || !fuel) return { error: 'Carga no encontrada' }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select(`
      id,
      vehicles:vehicles!trips_vehicle_id_fkey (plate),
      trailers:vehicles!trips_trailer_id_fkey (plate)
    `)
    .eq('id', tripId)
    .is('deleted_at', null)
    .single()
  if (tripError || !trip) return { error: 'Viaje no encontrado' }

  const plate = normalizePlate(fuel.plate as string)
  const vehicles = trip.vehicles as { plate: string } | { plate: string }[] | null
  const trailers = trip.trailers as { plate: string } | { plate: string }[] | null
  const vehicle = Array.isArray(vehicles) ? vehicles[0] : vehicles
  const trailer = Array.isArray(trailers) ? trailers[0] : trailers
  let matchedRole: 'truck' | 'semi' | null = null
  if (vehicle?.plate && normalizePlate(vehicle.plate) === plate) matchedRole = 'truck'
  else if (trailer?.plate && normalizePlate(trailer.plate) === plate) matchedRole = 'semi'

  const previousTripId = fuel.trip_id as string | null

  const { error: updateError } = await supabase
    .from('fuel_transactions')
    .update({
      trip_id: tripId,
      match_status: 'linked',
      match_method: 'manual',
      matched_plate_role: matchedRole,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fuelTransactionId)
  if (updateError) return { error: updateError.message }

  await recalculateTripTotals(supabase, tripId)
  if (previousTripId && previousTripId !== tripId) await recalculateTripTotals(supabase, previousTripId)

  await logAudit({
    action: AUDIT_ACTIONS.fuelLinkTrip,
    entityType: 'fuel_transaction',
    entityId: fuelTransactionId,
    summary: 'Vinculó una carga de combustible a un viaje',
    metadata: { tripId, previousTripId },
  })

  revalidateFuelPaths(tripId, previousTripId)
  return { success: 'Carga vinculada al viaje' }
}

export async function deleteFuelTransaction(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: fuel, error: fetchError } = await supabase
    .from('fuel_transactions')
    .select('trip_id, plate')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (fetchError || !fuel) return { error: 'Carga no encontrada' }

  const tripId = fuel.trip_id as string | null

  const { error } = await supabase
    .from('fuel_transactions')
    .update({ ...softDeleteUpdate(), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  if (tripId) await recalculateTripTotals(supabase, tripId)

  await logAudit({
    action: AUDIT_ACTIONS.fuelDelete,
    entityType: 'fuel_transaction',
    entityId: id,
    summary: `Eliminó una carga de combustible de ${fuel.plate}`,
    metadata: { tripId },
  })

  revalidateFuelPaths(tripId)
  return { success: 'Carga eliminada' }
}
