import {
  DASHBOARD_PERIODS,
  dashboardPeriodLabels,
  formatPeriodRangeLabel,
  getDashboardPeriodRange,
  parseDashboardPeriod,
  type DashboardPeriod,
} from '@/lib/dashboard/periods'
import type { CargoType, Trip, TripStatus, TripType } from '@/lib/types'

export type TripQuickFilter = 'all' | 'pending_payment' | 'paid' | 'with_pdf'

export type TripPdfFilter = 'all' | 'yes' | 'no'

export type TripDatePeriod = 'all' | 'custom' | DashboardPeriod

export const TRIP_DATE_PERIOD_OPTIONS: TripDatePeriod[] = [
  'all',
  'current_month',
  'previous_month',
  'last_3_months',
  'last_6_months',
  'year_to_date',
  'last_12_months',
  'custom',
]

export const tripDatePeriodLabels: Record<TripDatePeriod, string> = {
  all: 'Todas las fechas',
  custom: 'Rango personalizado',
  ...dashboardPeriodLabels,
}

export type TripListFilters = {
  search: string
  status: TripStatus | 'all'
  quick: TripQuickFilter
  clientId: string
  driverId: string
  vehicleId: string
  tripType: TripType | 'all'
  cargoType: CargoType | 'all'
  datePeriod: TripDatePeriod
  dateFrom: string
  dateTo: string
  pdf: TripPdfFilter
}

export const DEFAULT_TRIP_LIST_FILTERS: TripListFilters = {
  search: '',
  status: 'all',
  quick: 'all',
  clientId: 'all',
  driverId: 'all',
  vehicleId: 'all',
  tripType: 'all',
  cargoType: 'all',
  datePeriod: 'all',
  dateFrom: '',
  dateTo: '',
  pdf: 'all',
}

function parseEnum<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  if (!value) return null
  return allowed.includes(value as T) ? (value as T) : null
}

export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function patchTripDatePeriod(
  period: TripDatePeriod,
  now = new Date()
): Pick<TripListFilters, 'datePeriod' | 'dateFrom' | 'dateTo'> {
  if (period === 'all') {
    return { datePeriod: 'all', dateFrom: '', dateTo: '' }
  }

  if (period === 'custom') {
    return { datePeriod: 'custom', dateFrom: '', dateTo: '' }
  }

  const range = getDashboardPeriodRange(period, now)
  return {
    datePeriod: period,
    dateFrom: formatDateInputValue(range.from),
    dateTo: formatDateInputValue(range.to),
  }
}

function parseDatePeriodFromParams(params: URLSearchParams): Pick<TripListFilters, 'datePeriod' | 'dateFrom' | 'dateTo'> {
  const periodParam = params.get('period')
  const dateFrom = params.get('from') ?? ''
  const dateTo = params.get('to') ?? ''

  if (periodParam === 'custom' || (!periodParam && (dateFrom || dateTo))) {
    return {
      datePeriod: dateFrom || dateTo ? 'custom' : 'all',
      dateFrom,
      dateTo,
    }
  }

  if (periodParam && periodParam !== 'all' && DASHBOARD_PERIODS.includes(periodParam as DashboardPeriod)) {
    return patchTripDatePeriod(parseDashboardPeriod(periodParam))
  }

  return { datePeriod: 'all', dateFrom: '', dateTo: '' }
}

export function parseTripListFilters(params: URLSearchParams): TripListFilters {
  const quick = parseEnum(params.get('quick'), ['all', 'pending_payment', 'paid', 'with_pdf'] as const) ?? 'all'
  const statusFromUrl = parseEnum(params.get('status'), [
    'in_progress',
    'delivered',
    'incomplete',
    'pending_wirtrack',
    'sent',
    'pending_payment',
    'paid',
  ] as const)

  let status: TripStatus | 'all' = statusFromUrl ?? 'all'
  let pdf: TripPdfFilter = parseEnum(params.get('pdf'), ['all', 'yes', 'no'] as const) ?? 'all'

  if (quick === 'pending_payment') status = 'pending_payment'
  else if (quick === 'paid') status = 'paid'
  else if (quick === 'with_pdf') pdf = 'yes'

  return {
    search: params.get('q') ?? '',
    status,
    quick,
    clientId: params.get('client') ?? 'all',
    driverId: params.get('driver') ?? 'all',
    vehicleId: params.get('vehicle') ?? 'all',
    tripType: parseEnum(params.get('tripType'), ['carta_porte', 'solo_remitos'] as const) ?? 'all',
    cargoType:
      parseEnum(params.get('cargoType'), ['general', 'grains', 'hazmat', 'cold_chain'] as const) ??
      'all',
    ...parseDatePeriodFromParams(params),
    pdf,
  }
}

export function buildTripListSearchParams(filters: TripListFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.search.trim()) params.set('q', filters.search.trim())
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.quick !== 'all') params.set('quick', filters.quick)
  if (filters.clientId !== 'all') params.set('client', filters.clientId)
  if (filters.driverId !== 'all') params.set('driver', filters.driverId)
  if (filters.vehicleId !== 'all') params.set('vehicle', filters.vehicleId)
  if (filters.tripType !== 'all') params.set('tripType', filters.tripType)
  if (filters.cargoType !== 'all') params.set('cargoType', filters.cargoType)
  if (filters.datePeriod !== 'all') {
    params.set('period', filters.datePeriod)
    if (filters.datePeriod === 'custom') {
      if (filters.dateFrom) params.set('from', filters.dateFrom)
      if (filters.dateTo) params.set('to', filters.dateTo)
    }
  }
  if (filters.pdf !== 'all') params.set('pdf', filters.pdf)

  return params
}

export function tripListDateValue(trip: Trip): Date {
  return trip.departureDate ?? trip.createdAt
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function parseInputDate(value: string): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function resolveTripDateRange(
  filters: TripListFilters,
  now = new Date()
): { from: Date | null; to: Date | null } {
  if (filters.datePeriod === 'all') {
    return { from: null, to: null }
  }

  if (filters.datePeriod === 'custom') {
    const from = parseInputDate(filters.dateFrom)
    const to = parseInputDate(filters.dateTo)
    return {
      from,
      to: to ? endOfDay(to) : null,
    }
  }

  const range = getDashboardPeriodRange(filters.datePeriod, now)
  return { from: range.from, to: range.to }
}

export function getTripDateRangeLabel(filters: TripListFilters, now = new Date()): string | null {
  if (filters.datePeriod === 'all') return null

  const { from, to } = resolveTripDateRange(filters, now)
  if (!from && !to) return null

  if (filters.datePeriod === 'custom') {
    const formatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
    if (from && to) return `${formatter.format(from)} – ${formatter.format(to)}`
    if (from) return `Desde ${formatter.format(from)}`
    if (to) return `Hasta ${formatter.format(to)}`
    return null
  }

  if (from && to) return formatPeriodRangeLabel({ from, to })
  return tripDatePeriodLabels[filters.datePeriod]
}

export function filterTrips(trips: Trip[], filters: TripListFilters): Trip[] {
  const q = filters.search.trim().toLowerCase()
  const { from, to: toEnd } = resolveTripDateRange(filters)

  return trips.filter((trip) => {
    const matchSearch =
      !q ||
      trip.code.toLowerCase().includes(q) ||
      trip.origin?.toLowerCase().includes(q) ||
      (trip.destination?.toLowerCase().includes(q) ?? false) ||
      (trip.client?.name.toLowerCase().includes(q) ?? false) ||
      (trip.client?.accountId?.toLowerCase().includes(q) ?? false) ||
      (trip.driver?.name.toLowerCase().includes(q) ?? false) ||
      (trip.vehicle?.plate.toLowerCase().includes(q) ?? false) ||
      (trip.trailer?.plate.toLowerCase().includes(q) ?? false)

    const matchStatus = filters.status === 'all' || trip.status === filters.status

    const matchQuick =
      filters.quick === 'all' ||
      (filters.quick === 'pending_payment' && trip.status === 'pending_payment') ||
      (filters.quick === 'paid' && trip.status === 'paid') ||
      (filters.quick === 'with_pdf' && !!trip.pdfStorageKey)

    const clientId = trip.arcorClientId ?? trip.clientId
    const matchClient = filters.clientId === 'all' || clientId === filters.clientId

    const matchDriver = filters.driverId === 'all' || trip.driverId === filters.driverId

    const matchVehicle =
      filters.vehicleId === 'all' ||
      trip.vehicleId === filters.vehicleId ||
      trip.trailerId === filters.vehicleId

    const matchTripType = filters.tripType === 'all' || trip.tripType === filters.tripType
    const matchCargoType = filters.cargoType === 'all' || trip.cargoType === filters.cargoType

    const tripDate = startOfDay(tripListDateValue(trip))
    const matchFrom = !from || tripDate >= from
    const matchTo = !toEnd || tripListDateValue(trip) <= toEnd

    const matchPdf =
      filters.pdf === 'all' ||
      (filters.pdf === 'yes' && !!trip.pdfStorageKey) ||
      (filters.pdf === 'no' && !trip.pdfStorageKey)

    return (
      matchSearch &&
      matchStatus &&
      matchQuick &&
      matchClient &&
      matchDriver &&
      matchVehicle &&
      matchTripType &&
      matchCargoType &&
      matchFrom &&
      matchTo &&
      matchPdf
    )
  })
}

export function countCustomTripFilters(filters: TripListFilters): number {
  let count = 0
  if (filters.clientId !== 'all') count++
  if (filters.driverId !== 'all') count++
  if (filters.vehicleId !== 'all') count++
  if (filters.tripType !== 'all') count++
  if (filters.cargoType !== 'all') count++
  if (filters.datePeriod !== 'all') count++
  if (filters.pdf !== 'all') count++
  return count
}

export function hasActiveTripFilters(filters: TripListFilters): boolean {
  return (
    !!filters.search.trim() ||
    filters.status !== 'all' ||
    filters.quick !== 'all' ||
    countCustomTripFilters(filters) > 0
  )
}

export function tripSortDate(trip: Trip) {
  return tripListDateValue(trip).getTime()
}
