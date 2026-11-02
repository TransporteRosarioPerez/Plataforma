export type CrmChannel = 'whatsapp' | 'email' | 'landing' | 'phone' | 'other'
export type CrmInboundStatus = 'pending' | 'accepted' | 'discarded'
export type CrmStage = 'nuevo' | 'cotizando' | 'enviada' | 'negociacion' | 'ganada' | 'perdida'
export type CrmServiceType = 'congelado' | 'refrigerado' | 'controlada' | 'seco'
export type CrmLoadType = 'completa' | 'parcial'
export type CrmFrequency = 'unica' | 'semanal' | 'quincenal' | 'mensual'

/** Lo que se pudo extraer de un mensaje o formulario. Todo opcional. */
export type ParsedRequest = {
  senderName?: string
  companyName?: string
  emails?: string[]
  phones?: string[]
  cuit?: string
  origin?: string
  originProvince?: string
  destination?: string
  destinationProvince?: string
  pallets?: number
  weightKg?: number
  serviceType?: CrmServiceType
  loadType?: CrmLoadType
  loadDate?: string
  frequency?: CrmFrequency
}

export type CrmCompany = {
  id: string
  name: string
  nameNorm: string
  cuit: string | null
  emailDomain: string | null
  website: string | null
  industry: string | null
  city: string | null
  province: string | null
  notes: string | null
  createdAt: string
}

export type CrmAlias = {
  id: string
  companyId: string
  alias: string
  aliasNorm: string
  source: 'manual' | 'triage' | 'merge'
}

export type CrmContact = {
  id: string
  companyId: string
  name: string | null
  email: string | null
  phone: string | null
  phoneNorm: string | null
  role: string | null
}

export type CrmInboundRequest = {
  id: string
  channel: CrmChannel
  status: CrmInboundStatus
  receivedAt: string
  senderName: string | null
  senderEmail: string | null
  senderPhone: string | null
  companyNameRaw: string | null
  cuitRaw: string | null
  subject: string | null
  message: string | null
  parsed: ParsedRequest
  companyId: string | null
  quoteId: string | null
  discardReason: string | null
  triagedAt: string | null
}

export type CrmQuote = {
  id: string
  number: number
  companyId: string
  companyName: string
  contactId: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  inboundRequestId: string | null
  channel: CrmChannel
  stage: CrmStage
  stageChangedAt: string
  position: number
  receivedAt: string
  serviceType: CrmServiceType | null
  loadType: CrmLoadType | null
  origin: string | null
  destination: string | null
  destinationProvince: string | null
  pallets: number | null
  weightKg: number | null
  loadDate: string | null
  frequency: CrmFrequency | null
  description: string | null
  suggestedAmount: number | null
  quotedAmount: number | null
  sentAt: string | null
  decidedAt: string | null
  validUntil: string | null
  lostReason: string | null
  lostNotes: string | null
  nextFollowupAt: string | null
  createdAt: string
}

export type CrmQuoteEvent = {
  id: string
  quoteId: string
  kind: 'created' | 'stage' | 'note' | 'amount' | 'update' | 'sent'
  fromStage: CrmStage | null
  toStage: CrmStage | null
  body: string | null
  metadata: Record<string, unknown>
  createdBy: string | null
  createdByName: string | null
  createdAt: string
}

export type CrmRate = {
  id: string
  province: string
  pricePerPallet: number | null
  priceFullTruck: number | null
  frozenSurchargePct: number
  notes: string | null
  isActive: boolean
}
