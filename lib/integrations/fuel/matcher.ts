import type { FuelMatchResult, FuelMatchStatus, MatchedPlateRole, NormalizedFuelRow, TripMatchCandidate } from './types'
import { normalizePlate } from './parse-csv'

/** Días extra de ventana si el viaje no tiene arrival_date */
export const FUEL_MATCH_GRACE_DAYS = 14

const ACTIVE_STATUSES = new Set([
  'in_progress',
  'delivered',
  'incomplete',
  'pending_wirtrack',
  'sent',
  'pending_payment',
])

export type TripForMatching = {
  id: string
  code: string
  status: string
  departureDate?: Date
  arrivalDate?: Date
  vehiclePlate?: string
  trailerPlate?: string
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + days)
  return result
}

function isWithinTripWindow(transactionAt: Date, trip: TripForMatching): boolean {
  if (!trip.departureDate) return false
  const start = startOfDay(trip.departureDate)
  const end = trip.arrivalDate
    ? endOfDay(trip.arrivalDate)
    : endOfDay(addDays(trip.departureDate, FUEL_MATCH_GRACE_DAYS))
  return transactionAt >= start && transactionAt <= end
}

function getMatchedRole(plate: string, trip: TripForMatching): MatchedPlateRole | null {
  const p = normalizePlate(plate)
  if (trip.vehiclePlate && normalizePlate(trip.vehiclePlate) === p) return 'truck'
  if (trip.trailerPlate && normalizePlate(trip.trailerPlate) === p) return 'semi'
  return null
}

function toCandidate(trip: TripForMatching, role: MatchedPlateRole): TripMatchCandidate {
  return {
    tripId: trip.id,
    tripCode: trip.code,
    departureDate: trip.departureDate!,
    arrivalDate: trip.arrivalDate,
    truckPlate: trip.vehiclePlate,
    semiPlate: trip.trailerPlate,
    matchedRole: role,
  }
}

function sortCandidates(a: TripMatchCandidate, b: TripMatchCandidate, trips: TripForMatching[]): number {
  const tripA = trips.find((t) => t.id === a.tripId)!
  const tripB = trips.find((t) => t.id === b.tripId)!
  const activeA = ACTIVE_STATUSES.has(tripA.status) ? 0 : 1
  const activeB = ACTIVE_STATUSES.has(tripB.status) ? 0 : 1
  if (activeA !== activeB) return activeA - activeB
  return b.departureDate.getTime() - a.departureDate.getTime()
}

export function matchFuelRowToTrips(
  row: NormalizedFuelRow,
  trips: TripForMatching[]
): FuelMatchResult {
  const plate = normalizePlate(row.plate)
  const candidates: TripMatchCandidate[] = []

  for (const trip of trips) {
    const role = getMatchedRole(plate, trip)
    if (!role) continue
    if (!isWithinTripWindow(row.transactionAt, trip)) continue
    candidates.push(toCandidate(trip, role))
  }

  if (candidates.length === 0) {
    return { status: 'unlinked' }
  }

  candidates.sort((a, b) => sortCandidates(a, b, trips))

  if (candidates.length === 1) {
    return {
      status: 'linked',
      tripId: candidates[0].tripId,
      matchedPlateRole: candidates[0].matchedRole,
    }
  }

  return {
    status: 'ambiguous',
    candidates,
  }
}

export function matchStatusLabel(status: FuelMatchStatus): string {
  switch (status) {
    case 'linked':
      return 'Vinculado'
    case 'unlinked':
      return 'Sin viaje'
    case 'ambiguous':
      return 'Viaje ambiguo'
  }
}
