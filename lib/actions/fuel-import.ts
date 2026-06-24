'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { normalizeFuelCsv } from '@/lib/integrations/fuel/normalize'
import { matchFuelRowToTrips } from '@/lib/integrations/fuel/matcher'
import type { FuelImportPreview, FuelImportPreviewRow } from '@/lib/integrations/fuel/types'
import {
  getExistingFuelExternalIds,
  getTripsForFuelMatching,
} from '@/lib/data/fuel-transactions'
import { recalculateTripTotals } from '@/lib/trip-totals'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import type { ActionState } from '@/lib/validations/parse-form'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import type { FuelMatchStatus } from '@/lib/types'

function revalidateFuelPaths(tripId?: string) {
  revalidatePath('/app/combustible')
  revalidatePath('/app/viajes')
  revalidatePath('/app/reportes')
  if (tripId) revalidatePath(`/app/viajes/${tripId}`)
}

function rowToDbInsert(
  row: FuelImportPreviewRow,
  batchId: string
) {
  const match = row.match
  const tripId = match.status === 'linked' ? match.tripId : null
  const matchStatus: FuelMatchStatus =
    match.status === 'linked' ? 'linked' : match.status === 'ambiguous' ? 'ambiguous' : 'unlinked'

  return {
    import_batch_id: batchId,
    provider: row.provider,
    external_id: row.externalId,
    transaction_at: row.transactionAt.toISOString(),
    plate: row.plate,
    station_name: row.stationName || null,
    product: row.product || null,
    product_kind: row.productKind,
    liters: row.liters,
    unit_price_net: row.unitPriceNet,
    unit_price_pvp: row.unitPricePvp,
    amount_net: row.amountNet,
    amount_taxes: row.amountTaxes,
    amount_total: row.amountTotal,
    ticket_number: row.ticketNumber,
    driver_name: row.driverName,
    card_number: row.cardNumber,
    trip_id: tripId ?? null,
    matched_plate_role: match.status === 'linked' ? match.matchedPlateRole : null,
    match_status: matchStatus,
    match_method: match.status === 'linked' ? 'auto' : null,
    raw_data: row.rawData,
  }
}

export async function previewFuelImport(
  csvText: string,
  fileName: string
): Promise<{ preview?: FuelImportPreview; error?: string }> {
  await requireSession()

  try {
    const parsed = normalizeFuelCsv(csvText)
    const trips = await getTripsForFuelMatching()
    const existingIds = await getExistingFuelExternalIds(
      parsed.provider,
      parsed.rows.map((r) => r.externalId)
    )

    const previewRows: FuelImportPreviewRow[] = []
    let skippedDuplicates = 0

    for (const row of parsed.rows) {
      if (existingIds.has(row.externalId)) {
        skippedDuplicates++
        continue
      }
      const match = matchFuelRowToTrips(row, trips)
      previewRows.push({ ...row, match })
    }

    await logAudit({
      action: AUDIT_ACTIONS.fuelImportPreview,
      summary: `Vista previa de importación de combustible (${fileName})`,
      metadata: { fileName, rowCount: previewRows.length },
    })

    return {
      preview: {
        provider: parsed.provider,
        fileName,
        rows: previewRows,
        skippedDuplicates,
        parseErrors: parsed.errors,
      },
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al procesar el CSV' }
  }
}

export async function confirmFuelImport(
  csvText: string,
  fileName: string
): Promise<ActionState & { imported?: number; linked?: number; unlinked?: number; skipped?: number }> {
  const session = await requireSession()
  const previewResult = await previewFuelImport(csvText, fileName)
  if (previewResult.error || !previewResult.preview) {
    return { error: previewResult.error ?? 'Error en preview' }
  }

  const { preview } = previewResult
  if (preview.rows.length === 0) {
    return { error: 'No hay filas nuevas para importar' }
  }

  const supabase = await createClient()

  const linkedCount = preview.rows.filter((r) => r.match.status === 'linked').length
  const unlinkedCount = preview.rows.filter((r) => r.match.status !== 'linked').length

  const { data: batch, error: batchError } = await supabase
    .from('fuel_import_batches')
    .insert({
      provider: preview.provider,
      file_name: fileName,
      row_count: preview.rows.length,
      linked_count: linkedCount,
      unlinked_count: unlinkedCount,
      skipped_duplicates: preview.skippedDuplicates,
      imported_by: session.user.id,
    })
    .select('id')
    .single()

  if (batchError || !batch) return { error: batchError?.message ?? 'Error al crear lote' }

  const inserts = preview.rows.map((row) => rowToDbInsert(row, batch.id))
  const { error: insertError } = await supabase.from('fuel_transactions').insert(inserts)
  if (insertError) return { error: insertError.message }

  const linkedTripIds = new Set(
    preview.rows.filter((r) => r.match.status === 'linked' && r.match.tripId).map((r) => r.match.tripId!)
  )
  for (const tripId of linkedTripIds) {
    await recalculateTripTotals(supabase, tripId)
  }

  revalidateFuelPaths()
  await logAudit({
    action: AUDIT_ACTIONS.fuelImportConfirm,
    entityType: 'fuel_transaction',
    entityId: batch.id,
    summary: `Importó ${preview.rows.length} cargas de combustible`,
    metadata: { fileName, linked: linkedCount, unlinked: unlinkedCount },
  })
  return {
    success: `Importadas ${preview.rows.length} cargas (${linkedCount} vinculadas, ${unlinkedCount} sin viaje)`,
    imported: preview.rows.length,
    linked: linkedCount,
    unlinked: unlinkedCount,
    skipped: preview.skippedDuplicates,
  }
}

export async function linkFuelToTrip(
  fuelTransactionId: string,
  tripId: string
): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: fuel, error: fuelError } = await supabase
    .from('fuel_transactions')
    .select('id, plate, trip_id')
    .eq('id', fuelTransactionId)
    .is('deleted_at', null)
    .single()

  if (fuelError || !fuel) return { error: 'Transacción no encontrada' }

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

  const plate = (fuel.plate as string).toUpperCase()
  const vehicles = trip.vehicles as { plate: string } | { plate: string }[] | null
  const trailers = trip.trailers as { plate: string } | { plate: string }[] | null
  const vehicle = Array.isArray(vehicles) ? vehicles[0] : vehicles
  const trailer = Array.isArray(trailers) ? trailers[0] : trailers
  let matchedRole: 'truck' | 'semi' | null = null
  if (vehicle?.plate?.toUpperCase() === plate) matchedRole = 'truck'
  else if (trailer?.plate?.toUpperCase() === plate) matchedRole = 'semi'

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
  if (previousTripId && previousTripId !== tripId) {
    await recalculateTripTotals(supabase, previousTripId)
  }

  revalidateFuelPaths(tripId)
  if (previousTripId && previousTripId !== tripId) revalidateFuelPaths(previousTripId)

  await logAudit({
    action: AUDIT_ACTIONS.fuelLinkTrip,
    entityType: 'fuel_transaction',
    entityId: fuelTransactionId,
    summary: 'Vinculó una carga de combustible a un viaje',
    metadata: { tripId, previousTripId },
  })

  return { success: 'Carga vinculada al viaje' }
}

export async function deleteFuelTransaction(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: fuel, error: fetchError } = await supabase
    .from('fuel_transactions')
    .select('trip_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !fuel) return { error: 'Transacción no encontrada' }

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
    summary: 'Eliminó una transacción de combustible',
    metadata: { tripId },
  })

  revalidateFuelPaths(tripId ?? undefined)
  revalidatePath('/app/papelera')
  return { success: 'Carga eliminada' }
}
