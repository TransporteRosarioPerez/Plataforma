import 'server-only'
import { createClient } from '@/lib/supabase/server'

/** Días de margen entre el movimiento de efectivo y su contraparte en el extracto. */
const WINDOW_DAYS = 5

function daysApart(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000
}

/**
 * Un movimiento de efectivo cargado a mano "entre cuentas" (ej. depósito en Macro) queda
 * esperando su contraparte del banco, que llega en el extracto. Esta función busca, para una
 * cuenta de banco, los movimientos de efectivo que la esperan y los empareja con el movimiento
 * del extracto (monto opuesto, ±5 días). El del banco pasa a ser interno: no suma dos veces.
 * Devuelve cuántos pares vinculó.
 */
export async function linkAwaitingCashTransfers(bankAccountId: string): Promise<number> {
  const supabase = await createClient()
  const { data: waiting } = await supabase
    .from('treasury_transactions')
    .select('id, tx_date, amount, category_id')
    .eq('raw_data->>awaitingAccountId', bankAccountId)
    .is('transfer_pair_id', null)
    .is('deleted_at', null)
  if (!waiting?.length) return 0

  const dates = waiting.map((w) => w.tx_date as string).sort()
  const from = new Date(`${dates[0]}T00:00:00Z`)
  from.setUTCDate(from.getUTCDate() - WINDOW_DAYS)
  const to = new Date(`${dates[dates.length - 1]}T00:00:00Z`)
  to.setUTCDate(to.getUTCDate() + WINDOW_DAYS)

  const { data: candidates } = await supabase
    .from('treasury_transactions')
    .select('id, tx_date, amount')
    .eq('account_id', bankAccountId)
    .eq('source', 'import')
    .eq('is_internal', false)
    .is('transfer_pair_id', null)
    .is('deleted_at', null)
    .gte('tx_date', from.toISOString().slice(0, 10))
    .lte('tx_date', to.toISOString().slice(0, 10))

  const used = new Set<string>()
  let linked = 0
  for (const cash of waiting) {
    const match = (candidates ?? [])
      .filter((c) => !used.has(c.id as string))
      .filter((c) => Math.abs(Number(c.amount) + Number(cash.amount)) <= 0.01)
      .filter((c) => daysApart(c.tx_date as string, cash.tx_date as string) <= WINDOW_DAYS)
      .sort((a, b) => daysApart(a.tx_date as string, cash.tx_date as string) - daysApart(b.tx_date as string, cash.tx_date as string))[0]
    if (!match) continue
    used.add(match.id as string)
    const bank = await supabase
      .from('treasury_transactions')
      .update({
        is_internal: true,
        category_id: cash.category_id,
        scope: null,
        classification: 'auto',
        rule_id: null,
        transfer_pair_id: cash.id,
      })
      .eq('id', match.id)
    if (bank.error) continue
    await supabase.from('treasury_transactions').update({ transfer_pair_id: match.id }).eq('id', cash.id)
    linked++
  }
  return linked
}
