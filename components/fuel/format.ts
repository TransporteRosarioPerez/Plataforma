import type { FuelPaymentMethod } from '@/lib/types'

export const formatArs = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export const formatPricePerLiter = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

export const formatLiters = (n: number) =>
  `${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(d)

export const paymentMethodLabels: Record<FuelPaymentMethod, string> = {
  cuenta_corriente: 'Cuenta corriente',
  contado: 'Contado / efectivo',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
}

/** En combustible, un semi con carga propia es el equipo de frío (térmico). */
export function vehicleTypeLabel(type?: 'truck' | 'semi' | 'trailer'): string {
  if (type === 'semi' || type === 'trailer') return 'Térmico / semi'
  if (type === 'truck') return 'Camión'
  return 'Sin vehículo'
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const name = MONTHS[Number(m) - 1] ?? m
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}
