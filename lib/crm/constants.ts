import type { CrmChannel, CrmFrequency, CrmLoadType, CrmServiceType, CrmStage } from './types'

/** Capacidad de un semi (dato de la empresa). */
export const PALLETS_PER_SEMI = 30
/** Origen habitual de las cargas. */
export const DEFAULT_ORIGIN = 'Buenos Aires'
/** Días de validez por defecto de una cotización. */
export const DEFAULT_VALIDITY_DAYS = 7

export const CHANNEL_LABELS: Record<CrmChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  landing: 'Web',
  phone: 'Teléfono',
  other: 'Otro',
}

export const STAGES: CrmStage[] = ['nuevo', 'cotizando', 'enviada', 'negociacion', 'ganada', 'perdida']
export const OPEN_STAGES: CrmStage[] = ['nuevo', 'cotizando', 'enviada', 'negociacion']
export const CLOSED_STAGES: CrmStage[] = ['ganada', 'perdida']

export const STAGE_LABELS: Record<CrmStage, string> = {
  nuevo: 'Nuevo',
  cotizando: 'Cotizando',
  enviada: 'Enviada',
  negociacion: 'Negociación',
  ganada: 'Ganada',
  perdida: 'Perdida',
}

export const STAGE_HINTS: Record<CrmStage, string> = {
  nuevo: 'Entró y todavía nadie la tomó',
  cotizando: 'Armando precio / consultando disponibilidad',
  enviada: 'Precio enviado al cliente',
  negociacion: 'El cliente respondió, se ajusta precio o condiciones',
  ganada: 'El cliente aceptó',
  perdida: 'No se hizo',
}

export const SERVICE_LABELS: Record<CrmServiceType, string> = {
  congelado: 'Congelado',
  refrigerado: 'Refrigerado',
  controlada: 'Temp. controlada',
  seco: 'Seco',
}

export const LOAD_TYPE_LABELS: Record<CrmLoadType, string> = {
  completa: 'Semi completo',
  parcial: 'Carga parcial',
}

export const FREQUENCY_LABELS: Record<CrmFrequency, string> = {
  unica: 'Única vez',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

export const LOST_REASONS = [
  'Precio',
  'Sin unidad disponible',
  'Destino no cubierto',
  'Fecha / plazo',
  'El cliente no respondió',
  'Eligió otro transporte',
  'Otro',
] as const

export const DISCARD_REASONS = [
  'No es una cotización',
  'Duplicado',
  'Spam',
  'Otro',
] as const

export const METRIC_PERIODS = [
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: '180', label: 'Últimos 6 meses' },
  { value: '365', label: 'Último año' },
]
