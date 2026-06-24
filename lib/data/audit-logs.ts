import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { AuditLog, AuditLogFilters, AuditLogsResult } from '@/lib/audit/types'

import type { UserRole } from '@/lib/types'

type DbAuditLog = {
  id: string
  actor_id: string
  actor_email: string
  actor_name: string
  actor_role: string
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  summary: string
  metadata: Record<string, unknown>
  created_at: string
}

function mapAuditLog(row: DbAuditLog): AuditLog {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    actorName: row.actor_name,
    actorRole: row.actor_role as UserRole,
    action: row.action,
    entityType: (row.entity_type as AuditLog['entityType']) ?? null,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    summary: row.summary,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at),
  }
}

export async function getAuditLogs(filters: AuditLogFilters): Promise<AuditLogsResult> {
  const supabase = await createClient()
  const page = Math.max(1, filters.page)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.actorId) {
    query = query.eq('actor_id', filters.actorId)
  }
  if (filters.actorRole) {
    query = query.eq('actor_role', filters.actorRole)
  }
  if (filters.action) {
    query = query.eq('action', filters.action)
  }
  if (filters.entityType) {
    query = query.eq('entity_type', filters.entityType)
  }
  if (filters.from) {
    query = query.gte('created_at', `${filters.from}T00:00:00.000Z`)
  }
  if (filters.to) {
    query = query.lte('created_at', `${filters.to}T23:59:59.999Z`)
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`
    query = query.or(`summary.ilike.${term},entity_label.ilike.${term},actor_name.ilike.${term},actor_email.ilike.${term}`)
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('[audit] getAuditLogs failed:', error.message)
    return { logs: [], total: 0, page, pageSize, totalPages: 0 }
  }

  const total = count ?? 0
  return {
    logs: (data ?? []).map((row) => mapAuditLog(row as DbAuditLog)),
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  }
}
