import type { AuditLogFilters } from '@/lib/audit/types'
import type { UserRole } from '@/lib/types'

export const DEFAULT_AUDIT_PAGE_SIZE = 50

function parseActorRole(value: string | undefined): UserRole | undefined {
  if (value === 'ops' || value === 'superadmin') return value
  return undefined
}

function getParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = searchParams[key]
  if (typeof value === 'string' && value.length > 0) return value
  return undefined
}

export function parseAuditLogFilters(
  searchParams: Record<string, string | string[] | undefined>
): AuditLogFilters {
  const page = Number(getParam(searchParams, 'page'))
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: DEFAULT_AUDIT_PAGE_SIZE,
    actorId: getParam(searchParams, 'actor'),
    actorRole: parseActorRole(getParam(searchParams, 'role')),
    action: getParam(searchParams, 'action'),
    entityType: getParam(searchParams, 'entity'),
    from: getParam(searchParams, 'from'),
    to: getParam(searchParams, 'to'),
    q: getParam(searchParams, 'q'),
  }
}

export function buildAuditLogQuery(
  filters: Partial<AuditLogFilters> & { page?: number }
): string {
  const params = new URLSearchParams()
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))
  if (filters.actorId) params.set('actor', filters.actorId)
  if (filters.actorRole) params.set('role', filters.actorRole)
  if (filters.action) params.set('action', filters.action)
  if (filters.entityType) params.set('entity', filters.entityType)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  const query = params.toString()
  return query ? `?${query}` : ''
}
