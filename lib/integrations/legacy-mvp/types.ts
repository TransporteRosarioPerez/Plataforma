/**
 * Tipos del sistema legado (Prisma / transporte-rosario-perez).
 * Fuente de verdad para scripts de migración y emparejamiento.
 */

export type LegacyWorkArea = 'driver' | 'administrative' | 'accountant'

export type LegacyTravelType = 'REFRIGERATED' | 'DRY'

/** 7 estados actuales (UNDER_OBSERVATION fue eliminado en mar 2025). */
export type LegacyTravelStatus =
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'INCOMPLETE'
  | 'PENDING_WIRTRACK'
  | 'SENT'
  | 'PENDING_PAYMENT'
  | 'PAID'

export type LegacyUser = {
  id: string
  fullName: string
  email: string | null
  dni: string | null
  workArea: LegacyWorkArea
  image: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type LegacyAnalyst = {
  id: string
  mail: string
  phone: string
  tel: string | null
}

export type LegacyClient = {
  id: string
  name: string
  accountId: string
  location: string
  analystId: string
}

export type LegacyTruck = {
  id: string
  licensePlate: string
  brand: string
  model: string
  deletedAt: string | null
}

export type LegacySemi = {
  id: string
  licensePlate: string
  brand: string
  model: string
  deletedAt: string | null
}

export type LegacyTravel = {
  id: string
  numberTrip: string
  numberOfClients: string
  source: string
  destination: string
  loadOriginDate: string
  estimatedDeliveryDate: string
  type: LegacyTravelType
  status: LegacyTravelStatus
  totalPallets: number
  totalPackages: number
  kmArcorSystem: number | null
  kmRealDriver: number | null
  kmSatelliteGoogle: number | null
  clientId: string
  driverId: string
  truckId: string
  semiId: string
  createdById: string
  pdfFileUrl: string | null
  pdfUploadedById: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export type LegacyObservation = {
  id: string
  content: string
  travelId: string
  createdAt: string
  updatedAt: string
}
