import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { restoreUpdate } from '@/lib/db/soft-delete'
import type { ActionState } from '@/lib/validations/parse-form'
import { revalidateTreasury } from './revalidate'
import { syncCheque, syncChequesForTransactions } from './cheques-sync'
import { assertMonthsOpen, ClosedMonthError } from './month-guard'

/**
 * Devuelve el movimiento y, si corresponde, su par creado por el sistema
 * (espejo de una regla o transferencia manual), para borrarlos/restaurarlos juntos.
 */
export async function linkedTransactionIds(id: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('treasury_transactions')
    .select('id, transfer_pair_id, source')
    .eq('id', id)
    .single()
  if (!data?.transfer_pair_id) return [id]
  const { data: pair } = await supabase
    .from('treasury_transactions')
    .select('id, source')
    .eq('id', data.transfer_pair_id)
    .single()
  const linked = pair && (pair.source === 'transfer_mirror' || data.source === 'transfer_mirror')
  return linked ? [id, pair.id as string] : [id]
}

function duplicateMessage(message: string, fallback: string) {
  return message.includes('duplicate') || message.includes('23505') ? fallback : message
}

/** Restauración desde la Papelera general. El llamador valida que sea superadmin. */
export async function restoreTreasuryTransaction(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const ids = await linkedTransactionIds(id)
  const guard = await guardRestore(ids)
  if (guard) return guard
  const { error } = await supabase.from('treasury_transactions').update(restoreUpdate).in('id', ids)
  if (error) {
    return { error: duplicateMessage(error.message, 'No se puede recuperar: ese movimiento ya se volvió a importar') }
  }
  await syncChequesForTransactions(ids)
  revalidateTreasury()
  return { success: 'Movimiento recuperado' }
}

/** Restaura la importación y los movimientos que se borraron junto con ella. */
export async function restoreTreasuryImportBatch(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: batch, error: batchError } = await supabase
    .from('treasury_import_batches')
    .select('deleted_at')
    .eq('id', id)
    .single()
  if (batchError || !batch?.deleted_at) return { error: 'Importación no encontrada' }
  const { data: batchTxs } = await supabase
    .from('treasury_transactions')
    .select('id')
    .eq('import_batch_id', id)
    .eq('deleted_at', batch.deleted_at)
  const guard = await guardRestore((batchTxs ?? []).map((t) => t.id as string))
  if (guard) return guard

  const { error: txError } = await supabase
    .from('treasury_transactions')
    .update(restoreUpdate)
    .eq('import_batch_id', id)
    .eq('deleted_at', batch.deleted_at)
  if (txError) {
    return { error: duplicateMessage(txError.message, 'No se puede recuperar: esos movimientos ya se volvieron a importar') }
  }
  const { error } = await supabase.from('treasury_import_batches').update(restoreUpdate).eq('id', id)
  if (error) return { error: error.message }
  const { data: restored } = await supabase
    .from('treasury_transactions')
    .select('id')
    .eq('import_batch_id', id)
    .is('deleted_at', null)
  await syncChequesForTransactions((restored ?? []).map((t) => t.id as string))
  revalidateTreasury()
  return { success: 'Importación recuperada con sus movimientos' }
}

/** Restaura un cheque y lo vuelve a vincular con su débito si ya está importado. */
export async function restoreTreasuryCheque(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('treasury_cheques').update(restoreUpdate).eq('id', id)
  if (error) {
    return { error: duplicateMessage(error.message, 'No se puede recuperar: ya hay otro cheque activo con ese número') }
  }
  await syncCheque(id)
  revalidateTreasury()
  return { success: 'Cheque recuperado' }
}

/** Restaurar movimientos cambia saldos: no se permite en meses cerrados. */
async function guardRestore(ids: string[]): Promise<ActionState | null> {
  if (ids.length === 0) return null
  const supabase = await createClient()
  const { data } = await supabase.from('treasury_transactions').select('account_id, tx_date').in('id', ids)
  try {
    await assertMonthsOpen((data ?? []).map((t) => ({ accountId: t.account_id as string, date: t.tx_date as string })))
    return null
  } catch (e) {
    if (e instanceof ClosedMonthError) return { error: e.message }
    throw e
  }
}

/** Restaura un arqueo junto con su ajuste (si se había registrado). */
export async function restoreTreasuryCashCount(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: count } = await supabase
    .from('treasury_cash_counts')
    .select('adjustment_transaction_id')
    .eq('id', id)
    .single()
  if (!count) return { error: 'Arqueo no encontrado' }
  if (count.adjustment_transaction_id) {
    const guard = await guardRestore([count.adjustment_transaction_id as string])
    if (guard) return guard
    await supabase.from('treasury_transactions').update(restoreUpdate).eq('id', count.adjustment_transaction_id)
  }
  const { error } = await supabase.from('treasury_cash_counts').update(restoreUpdate).eq('id', id)
  if (error) return { error: error.message }
  revalidateTreasury()
  return { success: 'Arqueo recuperado' }
}
