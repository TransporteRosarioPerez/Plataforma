import type { DocumentRecord } from '@/lib/types'

export type DocumentStatus = DocumentRecord['status']

const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires'

function calendarDayEpochUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function todayCalendarEpochUtc(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = Number(parts.find((p) => p.type === 'year')!.value)
  const m = Number(parts.find((p) => p.type === 'month')!.value)
  const d = Number(parts.find((p) => p.type === 'day')!.value)
  return Date.UTC(y, m - 1, d)
}

export function computeDocumentStatus(
  expiryDate: Date | null | undefined,
  daysBeforeWarning: number
): DocumentStatus {
  if (!expiryDate) return 'missing'

  const today = todayCalendarEpochUtc()
  const expiry = calendarDayEpochUtc(expiryDate)

  if (expiry < today) return 'expired'

  const warningLimit = today + daysBeforeWarning * 24 * 60 * 60 * 1000

  if (expiry <= warningLimit) return 'expiring_soon'

  return 'valid'
}

export function daysUntilExpiry(expiryDate: Date): number {
  const today = todayCalendarEpochUtc()
  const expiry = calendarDayEpochUtc(expiryDate)
  return Math.round((expiry - today) / (1000 * 60 * 60 * 24))
}

export const documentStatusLabels: Record<DocumentStatus, string> = {
  valid: 'Vigente',
  expiring_soon: 'Por vencer',
  expired: 'Vencido',
  missing: 'Sin fecha',
}

export const documentStatusColors: Record<DocumentStatus, string> = {
  valid: 'bg-green-500/10 text-green-700 border-green-500/30',
  expiring_soon: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  expired: 'bg-red-500/10 text-red-700 border-red-500/30',
  missing: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
}
