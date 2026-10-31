import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { formatMonthLabel } from '../closing-labels'

export class ClosedMonthError extends Error {}

/** Meses cerrados (yyyy-mm) de una cuenta. */
export async function getClosedMonths(accountId: string): Promise<Set<string>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('treasury_month_closes')
    .select('month')
    .eq('account_id', accountId)
    .eq('status', 'closed')
  return new Set((data ?? []).map((r) => String(r.month).slice(0, 7)))
}

/**
 * Cambios que mueven saldos (cargar, borrar o restaurar movimientos) no se permiten
 * en un mes cerrado: hay que reabrirlo primero en Cierres.
 */
export async function assertMonthsOpen(entries: { accountId: string; date: string }[]): Promise<void> {
  const byAccount = new Map<string, Set<string>>()
  for (const e of entries) {
    if (!byAccount.has(e.accountId)) byAccount.set(e.accountId, await getClosedMonths(e.accountId))
    const month = e.date.slice(0, 7)
    if (byAccount.get(e.accountId)!.has(month)) {
      const supabase = await createClient()
      const { data } = await supabase.from('treasury_accounts').select('name').eq('id', e.accountId).single()
      throw new ClosedMonthError(
        `${formatMonthLabel(month)} de ${data?.name ?? 'esta cuenta'} está cerrado. Reabrilo en Tesorería → Cierres para hacer cambios.`
      )
    }
  }
}
