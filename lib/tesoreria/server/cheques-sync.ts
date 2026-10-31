import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  classifyFromCheque,
  deriveChequeStatus,
  isChequeDebit,
  isChequeRejection,
  normalizeChequeNumber,
} from '../cheques'
import { CATEGORY_COLUMNS, CHEQUE_COLUMNS, mapCategory, mapCheque } from './mappers'

export type ChequeSyncResult = {
  linkedTransactionId: string | null
  status: string
  /** Hay un débito con ese número pero por otro monto. */
  amountMismatch: number | null
}

/**
 * Vincula un cheque del registro con lo que pasó en el banco:
 * - busca el débito (misma cuenta, mismo número, mismo monto) y lo clasifica con los datos del cheque
 *   (salvo que alguien lo haya clasificado a mano),
 * - detecta multas por rechazo,
 * - recalcula el estado.
 * Se llama al guardar un cheque, al importar extractos y al borrar/restaurar movimientos.
 */
export async function syncCheque(chequeId: string): Promise<ChequeSyncResult | null> {
  const supabase = await createClient()
  const { data: row } = await supabase.from('treasury_cheques').select(CHEQUE_COLUMNS).eq('id', chequeId).is('deleted_at', null).single()
  if (!row) return null
  const cheque = mapCheque(row)
  const number = normalizeChequeNumber(cheque.chequeNumber)

  const { data: candidates } = await supabase
    .from('treasury_transactions')
    .select('id, reference, description_norm, amount, classification')
    .eq('account_id', cheque.accountId)
    .is('deleted_at', null)
    .like('reference', `%${number}`)

  const sameNumber = (candidates ?? []).filter((t) => normalizeChequeNumber(t.reference as string) === number)

  // Débitos ya vinculados a OTRO cheque no se reutilizan.
  const { data: taken } = await supabase
    .from('treasury_cheques')
    .select('transaction_id')
    .neq('id', cheque.id)
    .is('deleted_at', null)
    .in('transaction_id', sameNumber.map((t) => t.id as string).concat('00000000-0000-0000-0000-000000000000'))
  const takenIds = new Set((taken ?? []).map((t) => t.transaction_id as string))

  const debits = sameNumber.filter((t) => isChequeDebit(t.description_norm as string, Number(t.amount)) && !takenIds.has(t.id as string))
  const debit = debits.find((t) => Math.abs(Number(t.amount) + cheque.amount) <= 0.01) ?? null
  const mismatch = !debit && debits.length > 0 ? -Number(debits[0].amount) : null
  const hasRejection = sameNumber.some((t) => isChequeRejection(t.description_norm as string))

  const status = deriveChequeStatus(cheque.status, !!debit, hasRejection)
  await supabase
    .from('treasury_cheques')
    .update({ status, transaction_id: debit?.id ?? null })
    .eq('id', cheque.id)

  if (debit && debit.classification !== 'manual') {
    const { data: cats } = await supabase.from('treasury_categories').select(CATEGORY_COLUMNS).is('deleted_at', null)
    const result = classifyFromCheque(cheque, (cats ?? []).map(mapCategory))
    if (result.classification === 'auto') {
      await supabase
        .from('treasury_transactions')
        .update({
          category_id: result.categoryId,
          scope: result.scope,
          is_internal: result.isInternal,
          classification: 'auto',
          rule_id: null,
          notes: `Cheque N° ${cheque.chequeNumber} · ${cheque.payeeName}`,
        })
        .eq('id', debit.id)
    }
  }

  return { linkedTransactionId: (debit?.id as string) ?? null, status, amountMismatch: mismatch }
}

/** Re-sincroniza los cheques vinculados a (o con el mismo número que) estos movimientos. */
export async function syncChequesForTransactions(transactionIds: string[]): Promise<void> {
  if (transactionIds.length === 0) return
  const supabase = await createClient()
  const { data: txs } = await supabase
    .from('treasury_transactions')
    .select('id, account_id, reference')
    .in('id', transactionIds)
  const ids = new Set<string>()

  const { data: linked } = await supabase
    .from('treasury_cheques')
    .select('id')
    .in('transaction_id', transactionIds)
    .is('deleted_at', null)
  for (const c of linked ?? []) ids.add(c.id as string)

  for (const tx of txs ?? []) {
    const number = normalizeChequeNumber(tx.reference as string)
    if (!number) continue
    const { data: byNumber } = await supabase
      .from('treasury_cheques')
      .select('id, cheque_number')
      .eq('account_id', tx.account_id)
      .is('deleted_at', null)
      .like('cheque_number', `%${number}`)
    for (const c of byNumber ?? []) {
      if (normalizeChequeNumber(c.cheque_number as string) === number) ids.add(c.id as string)
    }
  }

  for (const id of ids) await syncCheque(id)
}
