import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type {
  FuelImportBatch,
  FuelMatchMethod,
  FuelMatchStatus,
  FuelProductKind,
  FuelProvider,
  FuelTransaction,
  MatchedPlateRole,
} from '@/lib/types'
import type { TripForMatching } from '@/lib/integrations/fuel/matcher'

type DbFuelTransaction = {
  id: string
  import_batch_id: string | null
  provider: FuelProvider
  external_id: string
  transaction_at: string
  plate: string
  station_name: string | null
  product: string | null
  product_kind: FuelProductKind
  liters: number
  unit_price_net: number | null
  unit_price_pvp: number | null
  amount_net: number
  amount_taxes: number
  amount_total: number
  ticket_number: string | null
  driver_name: string | null
  card_number: string | null
  trip_id: string | null
  matched_plate_role: MatchedPlateRole | null
  match_status: FuelMatchStatus
  match_method: FuelMatchMethod | null
  created_at: string
  trips?: { code: string } | null
}

type DbFuelImportBatch = {
  id: string
  provider: FuelProvider
  file_name: string
  row_count: number
  linked_count: number
  unlinked_count: number
  skipped_duplicates: number
  created_at: string
}

function mapFuelTransaction(row: DbFuelTransaction): FuelTransaction {
  return {
    id: row.id,
    importBatchId: row.import_batch_id ?? undefined,
    provider: row.provider,
    externalId: row.external_id,
    transactionAt: new Date(row.transaction_at),
    plate: row.plate,
    stationName: row.station_name ?? undefined,
    product: row.product ?? undefined,
    productKind: row.product_kind,
    liters: Number(row.liters),
    unitPriceNet: row.unit_price_net != null ? Number(row.unit_price_net) : undefined,
    unitPricePvp: row.unit_price_pvp != null ? Number(row.unit_price_pvp) : undefined,
    amountNet: Number(row.amount_net),
    amountTaxes: Number(row.amount_taxes),
    amountTotal: Number(row.amount_total),
    ticketNumber: row.ticket_number ?? undefined,
    driverName: row.driver_name ?? undefined,
    cardNumber: row.card_number ?? undefined,
    tripId: row.trip_id ?? undefined,
    tripCode: row.trips?.code ?? undefined,
    matchedPlateRole: row.matched_plate_role ?? undefined,
    matchStatus: row.match_status,
    matchMethod: row.match_method ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

function mapFuelImportBatch(row: DbFuelImportBatch): FuelImportBatch {
  return {
    id: row.id,
    provider: row.provider,
    fileName: row.file_name,
    rowCount: row.row_count,
    linkedCount: row.linked_count,
    unlinkedCount: row.unlinked_count,
    skippedDuplicates: row.skipped_duplicates,
    createdAt: new Date(row.created_at),
  }
}

const fuelSelect = `
  *,
  trips (code)
`

export const getFuelTransactions = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fuel_transactions')
    .select(fuelSelect)
    .is('deleted_at', null)
    .order('transaction_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as DbFuelTransaction[]).map(mapFuelTransaction)
})

export const getFuelTransactionsByTripId = cache(async (tripId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fuel_transactions')
    .select(fuelSelect)
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('transaction_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as DbFuelTransaction[]).map(mapFuelTransaction)
})

export const getFuelImportBatches = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fuel_import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)
  return (data as DbFuelImportBatch[]).map(mapFuelImportBatch)
})

export async function getTripsForFuelMatching(): Promise<TripForMatching[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trips')
    .select(`
      id,
      code,
      status,
      departure_date,
      arrival_date,
      vehicles:vehicles!trips_vehicle_id_fkey (plate),
      trailers:vehicles!trips_trailer_id_fkey (plate)
    `)
    .is('deleted_at', null)
    .not('departure_date', 'is', null)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const vehicles = row.vehicles as { plate: string } | { plate: string }[] | null
    const trailers = row.trailers as { plate: string } | { plate: string }[] | null
    const vehicle = Array.isArray(vehicles) ? vehicles[0] : vehicles
    const trailer = Array.isArray(trailers) ? trailers[0] : trailers
    return {
      id: row.id as string,
      code: row.code as string,
      status: row.status as string,
      departureDate: row.departure_date ? new Date(row.departure_date as string) : undefined,
      arrivalDate: row.arrival_date ? new Date(row.arrival_date as string) : undefined,
      vehiclePlate: vehicle?.plate,
      trailerPlate: trailer?.plate,
    }
  })
}

export async function getExistingFuelExternalIds(
  provider: FuelProvider,
  externalIds: string[]
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fuel_transactions')
    .select('external_id')
    .eq('provider', provider)
    .in('external_id', externalIds)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((r) => r.external_id as string))
}
