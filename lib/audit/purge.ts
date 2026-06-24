import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function purgeOldAuditLogs(): Promise<{ deleted: number }> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('purge_audit_logs')

  if (error) {
    throw new Error(error.message)
  }

  return { deleted: Number(data ?? 0) }
}
