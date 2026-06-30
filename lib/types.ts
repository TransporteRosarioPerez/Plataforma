// RemitoListo ERP Types

// User roles
export type UserRole = 'superadmin' | 'ops'

export type SessionProfile = {
  id: string
  email: string
  name: string
  role: UserRole
}

// Organization
export interface Organization {
  id: string
  name: string
  cuit?: string
  address?: string
  logo?: string
  createdAt: Date
}

// User/Team Member
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  organizationId: string
  avatar?: string
  createdAt: Date
}

// Invitation
export interface Invitation {
  id: string
  email: string
  role: UserRole
  organizationId: string
  status: 'pending' | 'accepted' | 'expired'
  createdAt: Date
  expiresAt: Date
}

// Vehicle (Truck)
export interface Vehicle {
  id: string
  organizationId: string
  plate: string
  brand: string
  model: string
  year: number
  type: 'truck' | 'semi' | 'trailer'
  vtvExpiry?: Date
  rutaExpiry?: Date
  insuranceExpiry?: Date
  status: 'active' | 'maintenance' | 'inactive'
}

// Driver
export interface Driver {
  id: string
  organizationId: string
  name: string
  dni: string
  licenseNumber: string
  licenseExpiry: Date
  lintiExpiry?: Date
  psychophysicalExpiry?: Date
  artExpiry?: Date
  phone?: string
  email?: string
  status: 'active' | 'inactive'
}

// Cliente real de la empresa (CRUD, vinculado a proformas)
export interface Client {
  id: string
  organizationId: string
  name: string
  accountId?: string
  cuit?: string
  address?: string
  phone?: string
  email?: string
  contactName?: string
}

/** Cliente operativo del viaje (catálogo arcor_clients — los que ya tenían cargados) */
export type ArcorClient = Client

// Cargo types
export type CargoType = 'general' | 'grains' | 'hazmat' | 'cold_chain' | 'super_frozen'

export const CARGO_TYPES: CargoType[] = [
  'cold_chain',
  'super_frozen',
  'general',
  'grains',
  'hazmat',
]

// Trip type
export type TripType = 'carta_porte' | 'solo_remitos'

// Trip status (7 estados operativos del legado)
export type TripStatus =
  | 'in_progress'
  | 'delivered'
  | 'incomplete'
  | 'pending_wirtrack'
  | 'sent'
  | 'pending_payment'
  | 'paid'

// Trip Document type
export type TripDocumentType = 'pesada' | 'carta_porte' | 'remito' | 'trip_pdf'

// Remito status
export type RemitoStatus = 'ok' | 'observado'

// Trip Document (PDF evidencia del viaje)
export interface TripDocument {
  id: string
  tripId: string
  documentType: TripDocumentType
  documentNumber?: string
  clientId?: string
  clientName?: string
  destination?: string
  fileName: string
  fileUrl: string
  storagePath?: string
  status: RemitoStatus
  observationNotes?: string
  observedFileName?: string
  observedFileUrl?: string
  uploadedAt: Date
}

// Expense Category (configurable por empresa)
export interface ExpenseCategory {
  id: string
  organizationId: string
  name: string
  code: string
  isDefault: boolean
  isActive: boolean
  createdAt: Date
}

// Seed expense categories
export const SEED_EXPENSE_CATEGORIES: Omit<ExpenseCategory, 'id' | 'organizationId' | 'createdAt'>[] = [
  { code: 'combustible', name: 'Combustible', isDefault: true, isActive: true },
  { code: 'peajes', name: 'Peajes', isDefault: true, isActive: true },
  { code: 'viaticos', name: 'Viáticos', isDefault: true, isActive: true },
  { code: 'reparaciones', name: 'Reparaciones en Ruta', isDefault: true, isActive: true },
  { code: 'anticipo_chofer', name: 'Anticipo al Chofer', isDefault: true, isActive: true },
  { code: 'estacionamiento', name: 'Estacionamiento', isDefault: true, isActive: true },
  { code: 'lavado', name: 'Lavado', isDefault: true, isActive: true },
  { code: 'otros', name: 'Otros', isDefault: true, isActive: true },
]

// Trip expense
export interface TripExpense {
  id: string
  tripId: string
  categoryId: string
  categoryName?: string
  description?: string
  amount: number
  paidBy: 'empresa' | 'chofer'
  receiptFileName?: string
  receiptFileUrl?: string
  expenseDate: Date
}

export type FuelProvider = 'ypf' | 'shell'
export type FuelProductKind = 'diesel' | 'urea' | 'lubricant' | 'other'
export type FuelMatchStatus = 'linked' | 'unlinked' | 'ambiguous'
export type FuelMatchMethod = 'auto' | 'manual'
export type MatchedPlateRole = 'truck' | 'semi'

export interface FuelImportBatch {
  id: string
  provider: FuelProvider
  fileName: string
  rowCount: number
  linkedCount: number
  unlinkedCount: number
  skippedDuplicates: number
  createdAt: Date
}

export interface FuelTransaction {
  id: string
  importBatchId?: string
  provider: FuelProvider
  externalId: string
  transactionAt: Date
  plate: string
  stationName?: string
  product?: string
  productKind: FuelProductKind
  liters: number
  unitPriceNet?: number
  unitPricePvp?: number
  amountNet: number
  amountTaxes: number
  amountTotal: number
  ticketNumber?: string
  driverName?: string
  cardNumber?: string
  tripId?: string
  tripCode?: string
  matchedPlateRole?: MatchedPlateRole
  matchStatus: FuelMatchStatus
  matchMethod?: FuelMatchMethod
  createdAt: Date
}

export type InventoryMovementType = 'purchase' | 'consumption' | 'adjustment'
export type InventoryAdjustmentDirection = 'increase' | 'decrease'
export type InventoryStockStatus = 'ok' | 'low' | 'out'

export interface InventoryCategory {
  id: string
  organizationId: string
  code: string
  name: string
  isActive: boolean
  createdAt: Date
}

export interface InventoryItem {
  id: string
  organizationId: string
  name: string
  sku?: string
  categoryId?: string
  category?: InventoryCategory
  unit: string
  minQuantity: number
  currentQuantity: number
  notes?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface InventoryMovement {
  id: string
  itemId: string
  movementType: InventoryMovementType
  quantity: number
  adjustmentDirection?: InventoryAdjustmentDirection
  unitCost?: number
  totalCost?: number
  supplierName?: string
  invoiceReference?: string
  movementDate: Date
  notes?: string
  createdAt: Date
}

export const inventoryMovementTypeLabels: Record<InventoryMovementType, string> = {
  purchase: 'Compra',
  consumption: 'Consumo',
  adjustment: 'Ajuste',
}

export function getInventoryStockStatus(item: Pick<InventoryItem, 'currentQuantity' | 'minQuantity'>): InventoryStockStatus {
  if (item.currentQuantity <= 0) return 'out'
  if (item.currentQuantity <= item.minQuantity) return 'low'
  return 'ok'
}

export const inventoryStockStatusLabels: Record<InventoryStockStatus, string> = {
  ok: 'OK',
  low: 'Stock bajo',
  out: 'Sin stock',
}

export const inventoryStockStatusColors: Record<InventoryStockStatus, string> = {
  ok: 'bg-green-500/10 text-green-800 border-green-500/30',
  low: 'bg-amber-500/10 text-amber-800 border-amber-500/30',
  out: 'bg-red-500/10 text-red-800 border-red-500/30',
}

// Proforma (orden de pago del cliente de facturación)
export interface ProformaLineItem {
  id: string
  proformaId: string
  tripId: string
  amount: number
  taxes: number
}

export interface Proforma {
  id: string
  organizationId: string
  proformaNumber: string
  clientId?: string
  clientName: string
  tripIds: string[]
  lineItems: ProformaLineItem[]
  subtotal: number
  taxes: number
  total: number
  fileName?: string
  fileUrl?: string
  status: 'pendiente' | 'facturada' | 'cobrada'
  receivedDate: Date
  notes?: string
  createdAt: Date
}

// Invoice (factura emitida)
export interface Invoice {
  id: string
  organizationId: string
  invoiceNumber: string
  invoiceType: 'A' | 'B' | 'C'
  clientId?: string
  clientName: string
  clientCuit?: string
  proformaId?: string
  tripIds: string[]
  subtotal: number
  iva: number
  total: number
  status: 'emitida' | 'cobrada' | 'anulada'
  issueDate: Date
  paidDate?: Date
  fileName?: string
  fileUrl?: string
  createdAt: Date
}

// Trip
export interface Trip {
  id: string
  organizationId: string
  code: string

  tripType: TripType

  arcorClientId?: string
  arcorClient?: ArcorClient
  /** @deprecated usar arcorClientId */
  clientId?: string
  /** @deprecated usar arcorClient */
  client?: ArcorClient

  vehicleId?: string
  vehicle?: Vehicle
  trailerId?: string
  trailer?: Vehicle
  driverId?: string
  driver?: Driver

  origin: string
  destination?: string
  numberOfClients?: string

  departureDate?: Date
  arrivalDate?: Date

  totalKilometers?: number
  kmArcorSystem?: number
  kmRealDriver?: number
  kmSatelliteGoogle?: number

  totalPallets?: number
  totalPackages?: number

  /** Precio por pallet estimado al cargar el viaje (no afecta profit). */
  unitPrice?: number
  /** Precio por pallet real snapshot al vincular proforma. */
  proformaUnitPrice?: number

  cargoType: CargoType
  cargoDescription?: string

  status: TripStatus

  pdfStorageKey?: string

  totalIncome: number
  totalExpenses: number
  profit: number

  notes?: string
  observationCount?: number
  createdAt: Date
  updatedAt: Date
}

export interface TripObservation {
  id: string
  tripId: string
  content: string
  createdAt: Date
  updatedAt: Date
}

// Status labels
export const tripStatusLabels: Record<TripStatus, string> = {
  in_progress: 'En curso',
  delivered: 'Entregado',
  incomplete: 'Incompleto',
  pending_wirtrack: 'Pendiente Wirtrack',
  sent: 'Enviado',
  pending_payment: 'Pendiente de pago',
  paid: 'Pagado',
}

export const tripStatusShortLabels: Record<TripStatus, string> = {
  in_progress: 'En curso',
  delivered: 'Entregado',
  incomplete: 'Incompleto',
  pending_wirtrack: 'P. Wirtrack',
  sent: 'Enviado',
  pending_payment: 'Pend. pago',
  paid: 'Pagado',
}

export const tripStatusColors: Record<TripStatus, string> = {
  in_progress: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
  delivered: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  incomplete: 'bg-red-500/10 text-red-700 border-red-500/30',
  pending_wirtrack: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
  sent: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/30',
  pending_payment: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  paid: 'bg-green-500/10 text-green-700 border-green-500/30',
}

export const TRIP_STATUSES: TripStatus[] = [
  'in_progress',
  'delivered',
  'incomplete',
  'pending_wirtrack',
  'sent',
  'pending_payment',
  'paid',
]

/** Estados operativos editables desde la ficha del viaje (no cobranza). */
export const OPERATIONAL_TRIP_STATUSES: TripStatus[] = TRIP_STATUSES.filter(
  (status) => status !== 'pending_payment' && status !== 'paid'
)

export const BILLING_TRIP_STATUSES: TripStatus[] = ['pending_payment', 'paid']

export const tripTypeLabels: Record<TripType, string> = {
  carta_porte: 'Con Carta de Porte',
  solo_remitos: 'Solo Remitos'
}

export const cargoTypeLabels: Record<CargoType, string> = {
  general: 'Seco / General',
  grains: 'Granos',
  hazmat: 'Peligrosa',
  cold_chain: 'Refrigerado',
  super_frozen: 'Supercongelado',
}

export const roleLabels: Record<UserRole, string> = {
  superadmin: 'Super Administrador',
  ops: 'Operador',
}

// Document entity type
export type DocumentEntityType = 'vehicle' | 'driver' | 'company'

export type RenewalFrequency = 'monthly' | 'biannual' | 'yearly' | 'triennial' | 'once'

export interface DocumentRecord {
  id: string
  organizationId: string
  name: string
  documentGroupId: string
  entityId: string
  entityType: DocumentEntityType
  fileName?: string
  fileUrl?: string
  issueDate?: Date
  expiryDate?: Date
  status: 'valid' | 'expiring_soon' | 'expired' | 'missing'
  uploadedAt?: Date
  notes?: string
  isCurrent: boolean
  supersededAt?: Date
  renewalFrequency: RenewalFrequency
}

// Onboarding step
export type OnboardingStep =
  | 'company'
  | 'fleet'
  | 'drivers'
  | 'requirements'
  | 'team'

// Dashboard KPIs
export interface DashboardKPIs {
  activeTrips: number
  completedThisMonth: number
  pendingInvoices: number
  pendingAmount: number
  expiringDocuments: number
  upcomingTrips: number
}
