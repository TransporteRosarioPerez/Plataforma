import type { DocumentRecord } from '@/lib/types'

export type DocumentStatus = DocumentRecord['status']

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function computeDocumentStatus(
  expiryDate: Date | null | undefined,
  daysBeforeWarning: number
): DocumentStatus {
  if (!expiryDate) return 'missing'

  const today = startOfDay(new Date())
  const expiry = startOfDay(expiryDate)

  if (expiry < today) return 'expired'

  const warningLimit = new Date(today)
  warningLimit.setDate(warningLimit.getDate() + daysBeforeWarning)

  if (expiry <= warningLimit) return 'expiring_soon'

  return 'valid'
}

export function daysUntilExpiry(expiryDate: Date): number {
  const today = startOfDay(new Date())
  const expiry = startOfDay(expiryDate)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
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
