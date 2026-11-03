import type { Trip } from '@/lib/types'
import { formatGroupedNumber, parseGroupedNumber } from '@/lib/format/numbers'

export type AdjustmentDirection = 'up' | 'down'

export type TripLineAdjustment = {
  /** up = se cobra de más (suma), down = se descuenta (resta). */
  direction: AdjustmentDirection
  reason: string
}

export type TripLineValues = {
  /** Importe en formato es-AR. En ajustes es el valor absoluto de la diferencia. */
  amount: string
  taxes: string
  fromEstimate?: boolean
  /** Presente solo si la línea es un ajuste sobre un viaje ya facturado/cobrado. */
  adjustment?: TripLineAdjustment
}

/** Una línea anterior del viaje en otra proforma (para mostrar el historial). */
export type TripBillingHistoryEntry = {
  proformaId: string
  proformaNumber: string
  proformaStatus: 'pendiente' | 'facturada' | 'cobrada'
  receivedDate: Date
  amount: number
  isAdjustment: boolean
  adjustmentReason?: string
  /** Ingreso traído del sistema anterior (no es una proforma real). */
  isLegacy?: boolean
}

export function getTripEstimatedAmount(trip: Trip): number | null {
  if (trip.unitPrice == null || trip.totalPallets == null) return null
  if (trip.unitPrice <= 0 || trip.totalPallets <= 0) return null
  return trip.unitPrice * trip.totalPallets
}

export function amountsMatch(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance
}

/** Guarda el monto en formato es-AR para que NumberInput no lo re-parsee como miles. */
export function formatTripLineAmount(amount: number | undefined): string {
  if (amount === undefined) return ''
  return formatGroupedNumber(amount, { decimals: 2 })
}

export function parseTripLineAmount(amount: string): number {
  return parseGroupedNumber(amount) ?? 0
}

/** Importe con signo (los ajustes a la baja restan). */
export function signedTripLineAmount(line: TripLineValues | undefined): number {
  if (!line) return 0
  const value = Math.abs(parseTripLineAmount(line.amount))
  return line.adjustment?.direction === 'down' ? -value : value
}

export function buildAdjustmentLine(): TripLineValues {
  return { amount: '', taxes: '0', adjustment: { direction: 'up', reason: '' } }
}

/** JSON de líneas que esperan createProforma / updateProforma. */
export function buildLineItemsJson(
  tripIds: string[],
  lines: Record<string, TripLineValues>
): string {
  return JSON.stringify(
    tripIds.map((id) => {
      const line = lines[id]
      return {
        trip_id: id,
        amount: signedTripLineAmount(line),
        taxes: 0,
        is_adjustment: !!line?.adjustment,
        adjustment_reason: line?.adjustment?.reason.trim() || null,
      }
    })
  )
}

export function sumTripLines(tripIds: string[], lines: Record<string, TripLineValues>): number {
  return (
    Math.round(tripIds.reduce((sum, id) => sum + signedTripLineAmount(lines[id]), 0) * 100) / 100
  )
}

export function buildTripLineFromEstimate(trip: Trip): TripLineValues {
  const estimate = getTripEstimatedAmount(trip)
  if (estimate == null) return { amount: '', taxes: '0' }
  return {
    amount: formatTripLineAmount(Math.round(estimate * 100) / 100),
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
