import type { Trip } from '@/lib/types'

export type TripLineValues = { amount: string; taxes: string; fromEstimate?: boolean }

export function getTripEstimatedAmount(trip: Trip): number | null {
  if (trip.unitPrice == null || trip.totalPallets == null) return null
  if (trip.unitPrice <= 0 || trip.totalPallets <= 0) return null
  return trip.unitPrice * trip.totalPallets
}

export function amountsMatch(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance
}

export function buildTripLineFromEstimate(trip: Trip): TripLineValues {
  const estimate = getTripEstimatedAmount(trip)
  if (estimate == null) return { amount: '', taxes: '0' }
  return {
    amount: String(Math.round(estimate * 100) / 100),
    taxes: '0',
    fromEstimate: true,
  }
}

export function getTripEstimateComparison(trip: Trip) {
  const estimatedTotal = getTripEstimatedAmount(trip)
  const hasEstimate = trip.unitPrice != null && trip.totalPallets != null
  const hasProforma = trip.totalIncome > 0

  if (!hasEstimate && !hasProforma) return null

  const estimatedUnit = trip.unitPrice ?? null
  const proformaUnit = trip.proformaUnitPrice ?? null
  const proformaTotal = hasProforma ? trip.totalIncome : null

  const totalsMatch =
    estimatedTotal != null && proformaTotal != null
      ? amountsMatch(estimatedTotal, proformaTotal)
      : null
  const unitsMatch =
    estimatedUnit != null && proformaUnit != null
      ? amountsMatch(estimatedUnit, proformaUnit)
      : null

  return {
    estimatedUnit,
    estimatedTotal,
    proformaUnit,
    proformaTotal,
    totalsMatch,
    unitsMatch,
    pallets: trip.totalPallets ?? null,
  }
}
