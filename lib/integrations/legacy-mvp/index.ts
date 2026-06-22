/**
 * Capa de emparejamiento con el MVP legado (transporte-rosario-perez / Prisma).
 */

export * from './types'
export * from './mappers'

import type { TripContractFields } from '@/lib/domain/trips/contract'
import type { LegacyTravel } from './types'
import { LEGACY_TRAVEL_STATUS_MAP, mapLegacyTravelToTripInsert } from './mappers'

export type LegacyTripRecord = {
  externalId: string
  travel: LegacyTravel
  fkIds: {
    arcor_client_id: string
    vehicle_id: string
    trailer_id: string
    driver_id: string
    pdf_uploaded_by?: string | null
  }
}

export function mapLegacyTripToContract(record: LegacyTripRecord): Partial<TripContractFields> {
  const mapped = mapLegacyTravelToTripInsert(record.travel, record.fkIds)
  return {
    code: mapped.code,
    status: LEGACY_TRAVEL_STATUS_MAP[record.travel.status],
    origin: mapped.origin,
    destination: mapped.destination,
    externalId: record.externalId,
    legacySource: 'transporte-rosario-perez',
    pdfStorageKey: mapped.pdf_storage_key ?? undefined,
  }
}
