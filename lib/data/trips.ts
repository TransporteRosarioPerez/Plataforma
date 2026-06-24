import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapClient, mapDriver, mapVehicle, type DbClient, type DbDriver, type DbVehicle } from '@/lib/db/mappers'
import type { Trip, TripStatus, TripType, CargoType } from '@/lib/types'

type DbTrip = {
  id: string
  code: string
  status: string
  trip_type: string | null
  arcor_client_id: string | null
  vehicle_id: string | null
  trailer_id: string | null
  driver_id: string | null
  origin: string | null
  destination: string | null
  number_of_clients: string | null
  cargo_type: string | null
  cargo_description: string | null
  departure_date: string | null
  arrival_date: string | null
  total_kilometers: number | null
  km_arcor_system: number | null
  km_real_driver: number | null
  km_satellite_google: number | null
  total_pallets: number | null
  total_packages: number | null
  unit_price: number | null
  proforma_unit_price: number | null
  pdf_storage_key: string | null
  total_income: number
  total_expenses: number
  profit: number
  notes: string | null
  metadata: Record<string, unknown>
  external_id: string | null
  legacy_id: string | null
  legacy_source: string | null
  created_at: string
  updated_at: string
  arcor_clients?: DbClient | null
  vehicles?: DbVehicle | null
  trailers?: DbVehicle | null
  drivers?: DbDriver | null
}

function mapTrip(row: DbTrip, observationCount = 0): Trip {
  const arcorClient = row.arcor_clients ? mapClient(row.arcor_clients) : undefined
  return {
    id: row.id,
    organizationId: '',
    code: row.code,
    tripType: (row.trip_type as TripType) ?? 'carta_porte',
    arcorClientId: row.arcor_client_id ?? undefined,
    arcorClient,
    clientId: row.arcor_client_id ?? undefined,
    client: arcorClient,
    vehicleId: row.vehicle_id ?? undefined,
    vehicle: row.vehicles ? mapVehicle(row.vehicles) : undefined,
    trailerId: row.trailer_id ?? undefined,
    trailer: row.trailers ? mapVehicle(row.trailers) : undefined,
    driverId: row.driver_id ?? undefined,
    driver: row.drivers ? mapDriver(row.drivers) : undefined,
    origin: row.origin ?? '',
    destination: row.destination ?? undefined,
    numberOfClients: row.number_of_clients ?? undefined,
    departureDate: row.departure_date ? new Date(row.departure_date) : undefined,
    arrivalDate: row.arrival_date ? new Date(row.arrival_date) : undefined,
    totalKilometers: row.total_kilometers != null ? Number(row.total_kilometers) : undefined,
    kmArcorSystem: row.km_arcor_system != null ? Number(row.km_arcor_system) : undefined,
    kmRealDriver: row.km_real_driver != null ? Number(row.km_real_driver) : undefined,
    kmSatelliteGoogle: row.km_satellite_google != null ? Number(row.km_satellite_google) : undefined,
    totalPallets: row.total_pallets ?? undefined,
    totalPackages: row.total_packages ?? undefined,
    unitPrice: row.unit_price != null ? Number(row.unit_price) : undefined,
    proformaUnitPrice: row.proforma_unit_price != null ? Number(row.proforma_unit_price) : undefined,
    cargoType: (row.cargo_type as CargoType) ?? 'general',
    cargoDescription: row.cargo_description ?? undefined,
    status: row.status as TripStatus,
    pdfStorageKey: row.pdf_storage_key ?? undefined,
    totalIncome: Number(row.total_income),
    totalExpenses: Number(row.total_expenses),
    profit: Number(row.profit),
    notes: row.notes ?? undefined,
    observationCount,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

const tripSelect = `
  *,
  arcor_clients:arcor_clients!trips_arcor_client_id_fkey (*),
  vehicles:vehicles!trips_vehicle_id_fkey (*),
  trailers:vehicles!trips_trailer_id_fkey (*),
  drivers:drivers!trips_driver_id_fkey (*)
`

async function getObservationCountsByTripIds(tripIds: string[]) {
  if (tripIds.length === 0) return new Map<string, number>()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trip_observations')
    .select('trip_id')
    .in('trip_id', tripIds)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const tripId = row.trip_id as string
    counts.set(tripId, (counts.get(tripId) ?? 0) + 1)
  }
  return counts
}

export const getTrips = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trips')
    .select(tripSelect)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = data as DbTrip[]
  const observationCounts = await getObservationCountsByTripIds(rows.map((row) => row.id))
  return rows.map((row) => mapTrip(row, observationCounts.get(row.id) ?? 0))
})

export const getTripById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trips')
    .select(tripSelect)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return mapTrip(data as DbTrip)
})
