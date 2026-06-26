import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapClient, mapDriver, mapVehicle, type DbClient, type DbDriver, type DbVehicle } from '@/lib/db/mappers'
import {
  resolveTripDateRange,
  type TripListFilters,
} from '@/lib/trips/list-filters'
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

const proformaTripSelect = `
  id,
  code,
  status,
  trip_type,
  arcor_client_id,
  vehicle_id,
  trailer_id,
  driver_id,
  origin,
  destination,
  departure_date,
  arrival_date,
  cargo_type,
  total_pallets,
  unit_price,
  proforma_unit_price,
  total_income,
  total_expenses,
  profit,
  pdf_storage_key,
  created_at,
  updated_at,
  arcor_clients:arcor_clients!trips_arcor_client_id_fkey (*),
  vehicles:vehicles!trips_vehicle_id_fkey (*),
  trailers:vehicles!trips_trailer_id_fkey (*),
  drivers:drivers!trips_driver_id_fkey (*)
`

const fuelTripSelect = `
  id,
  code,
  vehicles:vehicles!trips_vehicle_id_fkey (plate),
  trailers:vehicles!trips_trailer_id_fkey (plate)
`

export type TripFuelOption = {
  id: string
  code: string
  vehiclePlate?: string
  trailerPlate?: string
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function getObservationCountsMap(): Promise<Map<string, number>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_trip_observation_counts')

  if (!error) {
    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      counts.set(row.trip_id as string, Number(row.observation_count ?? 0))
    }
    return counts
  }

  const counts = new Map<string, number>()
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data: rows, error: pageError } = await supabase
      .from('trip_observations')
      .select('trip_id')
      .is('deleted_at', null)
      .range(offset, offset + pageSize - 1)

    if (pageError) throw new Error(pageError.message)

    for (const row of rows ?? []) {
      const tripId = row.trip_id as string
      counts.set(tripId, (counts.get(tripId) ?? 0) + 1)
    }

    if (!rows || rows.length < pageSize) break
    offset += pageSize
  }

  return counts
}

import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'

function applyTripListFilters(
  query: PostgrestFilterBuilder<any, any, any, any, any>,
  filters: TripListFilters
) {
  let next = query

  if (filters.status !== 'all') {
    next = next.eq('status', filters.status)
  }
  if (filters.clientId !== 'all') {
    next = next.eq('arcor_client_id', filters.clientId)
  }
  if (filters.driverId !== 'all') {
    next = next.eq('driver_id', filters.driverId)
  }
  if (filters.vehicleId !== 'all') {
    next = next.or(`vehicle_id.eq.${filters.vehicleId},trailer_id.eq.${filters.vehicleId}`)
  }
  if (filters.tripType !== 'all') {
    next = next.eq('trip_type', filters.tripType)
  }
  if (filters.cargoType !== 'all') {
    next = next.eq('cargo_type', filters.cargoType)
  }
  if (filters.pdf === 'yes') {
    next = next.not('pdf_storage_key', 'is', null)
  }
  if (filters.pdf === 'no') {
    next = next.is('pdf_storage_key', null)
  }

  const { from, to } = resolveTripDateRange(filters)
  if (from) {
    next = next.gte('departure_date', formatDateOnly(from))
  }
  if (to) {
    next = next.lte('departure_date', formatDateOnly(to))
  }

  return next
}

export const getTripsForList = cache(async (filters: TripListFilters) => {
  const supabase = await createClient()
  let query = supabase
    .from('trips')
    .select(tripSelect)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  query = applyTripListFilters(query, filters)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data as DbTrip[]
  const observationCounts = await getObservationCountsMap()
  return rows.map((row) => mapTrip(row, observationCounts.get(row.id) ?? 0))
})

export const getTrips = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trips')
    .select(tripSelect)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = data as DbTrip[]
  const observationCounts = await getObservationCountsMap()
  return rows.map((row) => mapTrip(row, observationCounts.get(row.id) ?? 0))
})

export const getTripsForProformas = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trips')
    .select(proformaTripSelect)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data as DbTrip[]).map((row) => mapTrip(row, 0))
})

export const getTripFuelOptions = cache(async (): Promise<TripFuelOption[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trips')
    .select(fuelTripSelect)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const vehicles = row.vehicles as { plate: string } | { plate: string }[] | null
    const trailers = row.trailers as { plate: string } | { plate: string }[] | null
    const vehicle = Array.isArray(vehicles) ? vehicles[0] : vehicles
    const trailer = Array.isArray(trailers) ? trailers[0] : trailers

    return {
      id: row.id as string,
      code: row.code as string,
      vehiclePlate: vehicle?.plate,
      trailerPlate: trailer?.plate,
    }
  })
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
