import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ActionState } from '@/lib/validations/parse-form'
import type { CrmStage } from '../types'

export type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export function fail(e: unknown, fallback: string): ActionState {
  return { error: e instanceof Error ? e.message : fallback }
}

export function friendly(message: string): string {
  if (message.includes('crm_companies_name_norm_key')) return 'Ya existe una empresa con ese nombre'
  if (message.includes('crm_companies_cuit_key')) return 'Ya existe una empresa con ese CUIT'
  if (message.includes('crm_company_aliases_norm_key')) return 'Ese alias ya está asignado a otra empresa'
  if (message.includes('crm_rates_province_key')) return 'Esa provincia ya está en el tarifario'
  if (message.includes('duplicate')) return 'Ya existe un registro igual'
  return message
}

export async function currentUserId(supabase: SupabaseServer): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function logEvent(
  supabase: SupabaseServer,
  quoteId: string,
  ev: { kind: 'created' | 'stage' | 'note' | 'amount' | 'update' | 'sent'; fromStage?: CrmStage | null; toStage?: CrmStage | null; body?: string | null; metadata?: Record<string, unknown> },
  userId: string | null,
) {
  await supabase.from('crm_quote_events').insert({
    quote_id: quoteId,
    kind: ev.kind,
    from_stage: ev.fromStage ?? null,
    to_stage: ev.toStage ?? null,
    body: ev.body ?? null,
    metadata: ev.metadata ?? {},
    created_by: userId,
  })
}

/** Posición para poner una tarjeta arriba de todo en una columna. */
export async function topPosition(supabase: SupabaseServer, stage: CrmStage): Promise<number> {
  const { data } = await supabase
    .from('crm_quotes')
    .select('position')
    .eq('stage', stage)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .limit(1)
  const min = data?.[0]?.position
  return min === undefined || min === null ? 0 : Number(min) - 1
}
