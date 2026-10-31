import type {
  TreasuryCategory,
  TreasuryCategoryKind,
  TreasuryClassification,
  TreasuryScope,
} from '@/lib/tesoreria/types'

const currency = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compact = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatMoney(value: number): string {
  return currency.format(value)
}

export function formatMoneyCompact(value: number): string {
  return compact.format(value)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function formatMonth(key: string): string {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const scopeLabels: Record<TreasuryScope, string> = {
  empresa: 'Empresa',
  personal: 'Personal',
}

export const kindLabels: Record<TreasuryCategoryKind, string> = {
  income: 'Ingreso',
  expense: 'Egreso',
  internal: 'Interno',
}

export const classificationLabels: Record<TreasuryClassification, string> = {
  pending: 'Pendiente',
  auto: 'Automático',
  manual: 'Manual',
}

/** Categorías activas compatibles con el signo del movimiento. */
export function categoriesForAmount(categories: TreasuryCategory[], amount: number): TreasuryCategory[] {
  return categories.filter(
    (c) => c.isActive && (c.kind === 'internal' || (amount >= 0 ? c.kind === 'income' : c.kind === 'expense'))
  )
}

export function amountClass(amount: number): string {
  return amount >= 0 ? 'text-green-700 dark:text-green-400' : 'text-foreground'
}
