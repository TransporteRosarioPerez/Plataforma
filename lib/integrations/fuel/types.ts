export type FuelProvider = 'ypf' | 'shell'

export type FuelProductKind = 'diesel' | 'urea' | 'lubricant' | 'other'

export type FuelMatchStatus = 'linked' | 'unlinked' | 'ambiguous'

export type FuelMatchMethod = 'auto' | 'manual'

export type MatchedPlateRole = 'truck' | 'semi'

/** Contrato único de salida — ambos CSV producen este tipo */
export type NormalizedFuelRow = {
  provider: FuelProvider
  externalId: string
  transactionAt: Date
  plate: string
  stationName: string
  product: string
  productKind: FuelProductKind
  liters: number
  unitPriceNet: number | null
  unitPricePvp: number | null
  amountNet: number
  amountTaxes: number
  amountTotal: number
  ticketNumber: string | null
  driverName: string | null
  cardNumber: string | null
  rawData: Record<string, string>
}

export type FuelParseResult = {
  provider: FuelProvider
  rows: NormalizedFuelRow[]
  skipped: number
  errors: string[]
}

export type TripMatchCandidate = {
  tripId: string
  tripCode: string
  departureDate: Date
  arrivalDate?: Date
  truckPlate?: string
  semiPlate?: string
  matchedRole: MatchedPlateRole
}

export type FuelMatchResult = {
  status: FuelMatchStatus
  tripId?: string
  matchedPlateRole?: MatchedPlateRole
  candidates?: TripMatchCandidate[]
}

export type FuelImportPreviewRow = NormalizedFuelRow & {
  match: FuelMatchResult
}

export type FuelImportPreview = {
  provider: FuelProvider
  fileName: string
  rows: FuelImportPreviewRow[]
  skippedDuplicates: number
  parseErrors: string[]
}
