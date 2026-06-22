import type { CargoType, TripStatus, TripType } from '@/lib/types'
import type { LegacyTravel, LegacyTravelStatus, LegacyTravelType } from './types'

/** Estados legado → estados RemitoListo (1:1). */
export const LEGACY_TRAVEL_STATUS_MAP: Record<LegacyTravelStatus, TripStatus> = {
  IN_PROGRESS: 'in_progress',
  DELIVERED: 'delivered',
  INCOMPLETE: 'incomplete',
  PENDING_WIRTRACK: 'pending_wirtrack',
  SENT: 'sent',
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
}

export const LEGACY_TRAVEL_TYPE_MAP: Record<LegacyTravelType, CargoType> = {
  REFRIGERATED: 'cold_chain',
  DRY: 'general',
}

export function mapLegacyTravelToTripInsert(
  travel: LegacyTravel,
  fkIds: {
    arcor_client_id: string
    vehicle_id: string
    trailer_id: string
    driver_id: string
    pdf_uploaded_by?: string | null
  }
) {
  const pdfKey = legacyPdfStorageKey(travel.pdfFileUrl)
  return {
    code: travel.numberTrip,
    status: LEGACY_TRAVEL_STATUS_MAP[travel.status],
    trip_type: 'carta_porte' satisfies TripType,
    arcor_client_id: fkIds.arcor_client_id,
    vehicle_id: fkIds.vehicle_id,
    trailer_id: fkIds.trailer_id,
    driver_id: fkIds.driver_id,
    origin: travel.source,
    destination: travel.destination,
    number_of_clients: travel.numberOfClients,
    cargo_type: LEGACY_TRAVEL_TYPE_MAP[travel.type],
    cargo_description: `${travel.totalPallets} pallets · ${travel.totalPackages} bultos`,
    departure_date: travel.loadOriginDate,
    arrival_date: travel.estimatedDeliveryDate,
    total_pallets: travel.totalPallets,
    total_packages: travel.totalPackages,
    total_kilometers: travel.kmRealDriver ?? travel.kmArcorSystem ?? travel.kmSatelliteGoogle,
    km_arcor_system: travel.kmArcorSystem,
    km_real_driver: travel.kmRealDriver,
    km_satellite_google: travel.kmSatelliteGoogle,
    pdf_storage_key: pdfKey,
    pdf_uploaded_by: fkIds.pdf_uploaded_by ?? null,
    external_id: travel.id,
    legacy_id: travel.id,
    legacy_source: 'transporte-rosario-perez',
    metadata: {},
  }
}

/** Cliente operativo del viaje → tabla arcor_clients (post-migración 008). */
export function mapLegacyArcorClientToInsert(client: {
  id: string
  name: string
  accountId: string
  location: string
}) {
  return {
    name: client.name,
    account_id: client.accountId,
    legacy_id: client.id,
    address: client.location,
  }
}

/** Cliente de facturación → tabla clients (carga manual post-migración; no viene del legado). */
export function mapLegacyClientToInsert(
  client: { id: string; name: string; accountId: string; location: string },
  analyst?: { mail: string; phone: string; tel: string | null }
) {
  return {
    name: client.name,
    account_id: client.accountId,
    legacy_id: client.id,
    address: client.location,
    notes: analyst ? null : 'Analista: Desconocido',
    email: analyst?.mail ?? null,
    phone: analyst?.phone ?? analyst?.tel ?? null,
    contact_name: analyst?.mail ? analyst.mail.split('@')[0] : 'Desconocido',
  }
}

export function mapLegacyVehicleToInsert(
  vehicle: { id: string; licensePlate: string; brand: string; model: string },
  type: 'truck' | 'semi'
) {
  return {
    plate: vehicle.licensePlate.toUpperCase().replace(/\s/g, ''),
    brand: vehicle.brand,
    model: vehicle.model,
    year: new Date().getFullYear(),
    type,
    status: 'active' as const,
    legacy_id: vehicle.id,
  }
}

export function mapLegacyDriverUserToInsert(user: {
  id: string
  fullName: string
  dni: string | null
  email: string | null
}) {
  return {
    name: user.fullName,
    dni: user.dni ?? '00000000',
    email: user.email,
    status: 'active' as const,
    legacy_id: user.id,
  }
}

export function legacyPdfStorageKey(pdfFileUrl: string | null | undefined): string | null {
  if (!pdfFileUrl) return null
  return pdfFileUrl
}

export function mapLegacyPdfDocument(tripId: string, storageKey: string) {
  const fileName = storageKey.split('/').pop() ?? storageKey
  return {
    trip_id: tripId,
    document_type: 'trip_pdf',
    file_name: fileName,
    file_url: storageKey,
    storage_path: storageKey,
    status: 'ok',
    metadata: {},
  }
}
