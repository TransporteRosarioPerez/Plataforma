import type { createServiceRoleClient } from '@/lib/supabase/service-role'

export type AlertMilestone = 'window_entry' | 'days_3'

type SupabaseClient = ReturnType<typeof createServiceRoleClient>

/** Hitos de aviso preventivo: entrada en ventana + 3 días antes del vencimiento. */
export function resolveAlertMilestone(
  daysUntilExpiry: number,
  alertDaysBefore: number
): AlertMilestone | null {
  if (daysUntilExpiry <= 0) return null
  if (daysUntilExpiry === 3) return 'days_3'
  if (daysUntilExpiry === alertDaysBefore) return 'window_entry'
  if (daysUntilExpiry < alertDaysBefore && daysUntilExpiry > 3) return 'window_entry'
  return null
}

async function wasMilestoneNotified(
  supabase: SupabaseClient,
  documentId: string,
  milestone: AlertMilestone
): Promise<boolean> {
  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('document_id', documentId)
    .filter('payload->>milestone', 'eq', milestone)
    .limit(1)

  return (data?.length ?? 0) > 0
}

export async function shouldNotifyDocument(
  supabase: SupabaseClient,
  documentId: string,
  daysUntilExpiry: number,
  alertDaysBefore: number
): Promise<{ notify: boolean; milestone: AlertMilestone | null }> {
  const milestone = resolveAlertMilestone(daysUntilExpiry, alertDaysBefore)
  if (!milestone) return { notify: false, milestone: null }

  if (await wasMilestoneNotified(supabase, documentId, milestone)) {
    return { notify: false, milestone: null }
  }

  return { notify: true, milestone }
}
