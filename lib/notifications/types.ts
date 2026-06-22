import type { AlertMilestone } from '@/lib/notifications/alert-milestones'

export type DocumentAlertItem = {
  documentId: string
  entityType: string
  entityId: string
  entityLabel: string
  documentType: string
  status: string
  expiryDate: string | null
  daysUntilExpiry: number | null
  notes: string | null
  milestone?: AlertMilestone
}
