import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { AuditAction } from '@/lib/audit/actions'
import type { AuditEntityType } from '@/lib/audit/types'

export type LogAuditInput = {
  action: AuditAction
  entityType?: AuditEntityType
  entityId?: string
  entityLabel?: string
  summary: string
  metadata?: Record<string, unknown>
}

export async function logAudit(input: LogAuditInput): Promise<void> {
  // Registra cualquier usuario autenticado (ops o superadmin); el RPC toma actor desde auth.uid().
  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('insert_audit_log', {
      p_action: input.action,
      p_entity_type: input.entityType ?? null,
      p_entity_id: input.entityId ?? null,
      p_entity_label: input.entityLabel ?? null,
      p_summary: input.summary,
      p_metadata: input.metadata ?? {},
    })
    if (error) {
      console.error('[audit] insert_audit_log failed:', error.message, input.action)
    }
  } catch (err) {
    console.error('[audit] unexpected error:', err instanceof Error ? err.message : err, input.action)
  }
}
