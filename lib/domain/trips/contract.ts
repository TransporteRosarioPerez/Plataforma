/**
 * Contrato de dominio de viajes — alineado al MVP legado (transporte-rosario-perez).
 */

export const TRIP_CONTRACT_VERSION = '1-legacy-travel' as const

export const OPERATIONAL_TRIP_STATUSES = [
  'in_progress',
  'delivered',
  'incomplete',
  'pending_wirtrack',
  'sent',
  'pending_payment',
  'paid',
] as const

export type OperationalTripStatus = (typeof OPERATIONAL_TRIP_STATUSES)[number]

export interface TripContractFields {
  code: string
  status: OperationalTripStatus
  origin?: string
  destination?: string
  metadata?: Record<string, unknown>
  externalId?: string
  legacySource?: string
  pdfStorageKey?: string
}
