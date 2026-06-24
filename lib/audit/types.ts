import type { UserRole } from '@/lib/types'

export type AuditEntityType =
  | 'trip'
  | 'proforma'
  | 'profile'
  | 'arcor_client'
  | 'client'
  | 'vehicle'
  | 'driver'
  | 'entity_document'
  | 'invoice'
  | 'fuel_transaction'
  | 'inventory_item'
  | 'inventory_movement'
  | 'expense_category'
  | 'company_settings'
  | 'alert_settings'
  | 'trip_observation'
  | 'trip_document'
  | 'trip_expense'
  | 'session'

export type AuditLog = {
  id: string
  actorId: string
  actorEmail: string
  actorName: string
  actorRole: UserRole
  action: string
  entityType: AuditEntityType | null
  entityId: string | null
  entityLabel: string | null
  summary: string
  metadata: Record<string, unknown>
  createdAt: Date
}

export type AuditLogFilters = {
  page: number
  pageSize: number
  actorId?: string
  actorRole?: UserRole
  action?: string
  entityType?: string
  from?: string
  to?: string
  q?: string
}

export type AuditLogsResult = {
  logs: AuditLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
