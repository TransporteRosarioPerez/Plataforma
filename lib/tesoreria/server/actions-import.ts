'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionState } from '@/lib/validations/parse-form'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { revalidateTreasury } from './revalidate'
import {
  getAccounts,
  getCategories,
  getCounterparties,
  getExistingDedupKeys,
  getCheques,
  getLastLoadedBalance,
  getRules,
} from './data'
import { assertMonthsOpen, getClosedMonths } from './month-guard'
import { detectImportGap } from '../closing'
import { formatMonthLabel } from '../closing-labels'
import { parseStatement, providerLabel } from '../parsers'
import { isMercadoPagoText, parseMercadoPagoText } from '../mercadopago'
import { isIcbcText, parseIcbcText } from '../icbc'
import { extractPdfText } from './pdf'
import { syncCheque, syncChequesForTransactions } from './cheques-sync'
import { linkAwaitingCashTransfers } from './transfer-link'
import { classifyFromCheque, matchCheque, matchRejectedCheque } from '../cheques'
import { buildDedupKeys, classify, countBalanceBreaks } from '../engine'
import { extractCuit, normalizeDescription } from '../text'
import type { ImportPreview, ImportPreviewRow, SheetCell } from '../types'

const cellsSchema = z
  .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).max(60))
  .max(20000)

/** Lo que manda el navegador: las celdas de una planilla (.xls/.xlsx/.csv) o un PDF en base64. */
export type StatementUpload =
  | { kind: 'cells'; cells: unknown }
  | { kind: 'pdf'; base64: string }

const uploadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cells'), cells: cellsSchema }),
  z.object({ kind: z.literal('pdf'), base64: z.string().min(10).max(8_000_000) }),
])

async function uploadToCells(upload: unknown): Promise<{ cells: SheetCell[][]; warnings: string[] }> {
  const parsed = uploadSchema.safeParse(upload)
  if (!parsed.success) throw new Error('El archivo no tiene un formato válido')
  if (parsed.data.kind === 'cells') return { cells: parsed.data.cells as SheetCell[][], warnings: [] }

  const text = await extractPdfText(parsed.data.base64)
  if (isMercadoPagoText(text)) {
    const mp = parseMercadoPagoText(text)
    return { cells: mp.cells, warnings: mercadoPagoWarnings(mp) }
  }
  if (isIcbcText(text)) {
    const icbc = parseIcbcText(text)
    return { cells: icbc.cells, warnings: icbc.warnings }
  }
  throw new Error(
    'Este PDF no es un resumen de Mercado Pago ni de ICBC. Macro y Nación se importan en Excel.'
  )
}

/** Cruza los movimientos leídos con el saldo inicial/final que informa el propio PDF. */
function mercadoPagoWarnings(mp: ReturnType<typeof parseMercadoPagoText>): string[] {
  const rows = parseStatement(mp.cells).rows
  if (rows.length === 0) return []
  const ordered = [...rows].sort((a, b) => a.statementOrder - b.statementOrder)
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  const warnings: string[] = []
  if (mp.openingBalance !== null && first.bankBalance !== null && Math.abs(mp.openingBalance + first.amount - first.bankBalance) > 0.01) {
    warnings.push('El saldo inicial del PDF no coincide con el primer movimiento leído: puede faltar un movimiento al principio')
  }
  if (mp.closingBalance !== null && last.bankBalance !== null && Math.abs(mp.closingBalance - last.bankBalance) > 0.01) {
    warnings.push('El saldo final del PDF no coincide con el último movimiento leído: puede faltar un movimiento al final')
  }
  return warnings
}

async function buildPreview(fileName: string, upload: unknown): Promise<ImportPreview> {
  const { cells, warnings } = await uploadToCells(upload)

  const statement = parseStatement(cells)
  if (statement.rows.length === 0) throw new Error('El extracto no tiene movimientos')
  statement.errors.unshift(...warnings)

  const accounts = await getAccounts(false)
  const account = accounts.find((a) => a.provider === statement.provider)
  if (!account) {
    throw new Error(`No hay una cuenta activa configurada para ${providerLabel(statement.provider)}`)
  }

  const [rules, counterparties, categories, cheques] = await Promise.all([
    getRules(),
    getCounterparties(),
    getCategories(),
    getCheques(account.id),
  ])
  const chequeWarnings: string[] = []
  const activeCategories = categories.filter((c) => c.isActive)
  const activeRules = rules.filter(
    (r) => r.isActive && (!r.categoryId || activeCategories.some((c) => c.id === r.categoryId))
  )

  const keys = buildDedupKeys(statement.rows)
  const existing = await getExistingDedupKeys(account.id, keys)

  const rows: ImportPreviewRow[] = statement.rows.map((row, i) => {
    const descriptionNorm = normalizeDescription(row.description)
    const counterpartyCuit = extractCuit(row.description)
    const chequeInput = { accountId: account.id, reference: row.reference, descriptionNorm, amount: row.amount }
    const chequeMatch = matchCheque(chequeInput, cheques)
    if (chequeMatch.kind === 'amount_mismatch' && !existing.has(keys[i])) {
      chequeWarnings.push(
        `Cheque N° ${chequeMatch.cheque.chequeNumber}: el banco debitó ${(-row.amount).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} y en el registro figura por ${chequeMatch.cheque.amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`
      )
    }
    const ruleResult = classify(
      { descriptionNorm, amount: row.amount, accountId: account.id, counterpartyCuit },
      activeRules,
      counterparties,
      activeCategories
    )
    const fromCheque = chequeMatch.kind === 'match' ? classifyFromCheque(chequeMatch.cheque, activeCategories) : null
    return {
      ...row,
      descriptionNorm,
      counterpartyCuit,
      dedupKey: keys[i],
      isDuplicate: existing.has(keys[i]),
      // El cheque registrado manda sobre las reglas (si el cheque no tiene categoría, quedan las reglas).
      result: fromCheque && fromCheque.classification === 'auto' ? fromCheque : ruleResult,
      chequeId: chequeMatch.kind === 'match' ? chequeMatch.cheque.id : null,
      rejectedChequeId: matchRejectedCheque(chequeInput, cheques)?.id ?? null,
    }
  })
  statement.errors.push(...chequeWarnings)

  const fresh = rows.filter((r) => !r.isDuplicate)
  const dates = statement.rows.map((r) => r.txDate).sort()

  // Hueco con lo ya cargado: el saldo con el que arranca el archivo tiene que encadenar.
  const firstDate = dates[0]
  const lastLoaded = firstDate ? await getLastLoadedBalance(account.id, firstDate) : null
  const gap = detectImportGap(lastLoaded, statement.rows, rows.length - fresh.length)

  // Movimientos nuevos que caerían en meses ya cerrados.
  const closed = await getClosedMonths(account.id)
  const closedMonths = [...new Set(fresh.map((r) => r.txDate.slice(0, 7)).filter((m) => closed.has(m)))].sort()

  return {
    provider: statement.provider,
    accountId: account.id,
    accountName: account.name,
    fileName,
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
    rows,
    newCount: fresh.length,
    duplicateCount: rows.length - fresh.length,
    autoCount: fresh.filter((r) => r.result.classification === 'auto').length,
    pendingCount: fresh.filter((r) => r.result.classification === 'pending').length,
    balanceBreaks: countBalanceBreaks(statement.rows),
    chequeMatches: fresh.filter((r) => r.chequeId).length,
    closedMonths,
    gap,
    errors: statement.errors,
  }
}

/** Paso 1: leer, detectar banco, deduplicar y clasificar. No escribe nada. */
export async function previewTreasuryImport(
  fileName: string,
  upload: StatementUpload
): Promise<{ preview?: ImportPreview; error?: string }> {
  try {
    await requireSuperadmin()
    return { preview: await buildPreview(fileName, upload) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al leer el extracto' }
  }
}

/** Paso 2: vuelve a calcular la vista previa en el servidor y guarda sólo los nuevos. */
export async function confirmTreasuryImport(
  fileName: string,
  upload: StatementUpload,
  options: { allowClosedMonths?: boolean } = {}
): Promise<ActionState & { imported?: number }> {
  try {
    const session = await requireSuperadmin()
    const preview = await buildPreview(fileName, upload)
    const fresh = preview.rows.filter((r) => !r.isDuplicate)
    if (fresh.length === 0) return { error: 'No hay movimientos nuevos: todo el extracto ya estaba cargado' }
    if (preview.closedMonths.length > 0 && !options.allowClosedMonths) {
      return {
        error: `Este extracto trae movimientos de ${preview.closedMonths.map(formatMonthLabel).join(', ')}, que ya está cerrado. Confirmá que querés cargarlos.`,
      }
    }

    const supabase = await createClient()
    const { data: batch, error: batchError } = await supabase
      .from('treasury_import_batches')
      .insert({
        account_id: preview.accountId,
        file_name: fileName,
        date_from: preview.dateFrom,
        date_to: preview.dateTo,
        row_count: fresh.length,
        auto_count: preview.autoCount,
        pending_count: preview.pendingCount,
        skipped_duplicates: preview.duplicateCount,
        balance_breaks: preview.balanceBreaks,
        imported_by: session.user.id,
      })
      .select('id')
      .single()
    if (batchError || !batch) return { error: batchError?.message ?? 'No se pudo crear el lote' }

    const inserts: Record<string, unknown>[] = []
    for (const row of fresh) {
      const id = randomUUID()
      const mirrorId = row.result.transferAccountId ? randomUUID() : null
      inserts.push({
        id,
        account_id: preview.accountId,
        import_batch_id: batch.id,
        source: 'import',
        tx_date: row.txDate,
        reference: row.reference,
        description_raw: row.description,
        description_norm: row.descriptionNorm,
        amount: row.amount,
        bank_balance: row.bankBalance,
        statement_order: row.statementOrder,
        counterparty_cuit: row.counterpartyCuit,
        category_id: row.result.categoryId,
        scope: row.result.scope,
        is_internal: row.result.isInternal,
        transfer_pair_id: mirrorId,
        classification: row.result.classification,
        rule_id: row.result.ruleId,
        dedup_key: row.dedupKey,
        raw_data: row.raw,
        created_by: session.user.id,
      })
      // Espejo en la otra cuenta (ej.: la extracción de cajero entra a Efectivo).
      if (mirrorId && row.result.transferAccountId) {
        inserts.push({
          id: mirrorId,
          account_id: row.result.transferAccountId,
          import_batch_id: batch.id,
          source: 'transfer_mirror',
          tx_date: row.txDate,
          reference: row.reference,
          description_raw: `${row.description} (desde ${preview.accountName})`,
          description_norm: normalizeDescription(`${row.description} DESDE ${preview.accountName}`),
          amount: -row.amount,
          category_id: row.result.categoryId,
          scope: null,
          is_internal: true,
          transfer_pair_id: id,
          classification: 'auto',
          rule_id: row.result.ruleId,
          raw_data: {},
          created_by: session.user.id,
        })
      }
    }

    for (let i = 0; i < inserts.length; i += 500) {
      // defaultToNull: false → una columna que falta en alguna fila toma su valor por defecto, no null.
      const { error } = await supabase
        .from('treasury_transactions')
        .insert(inserts.slice(i, i + 500), { defaultToNull: false })
      if (error) {
        // Sin transacciones en el cliente de Supabase: deshacemos el lote a mano.
        await supabase.from('treasury_transactions').delete().eq('import_batch_id', batch.id)
        await supabase.from('treasury_import_batches').delete().eq('id', batch.id)
        return { error: `No se pudo guardar el extracto: ${error.message}` }
      }
    }

    // Depósitos/retiros de efectivo cargados a mano que esperaban este extracto.
    const linkedCash = await linkAwaitingCashTransfers(preview.accountId)

    // Cheques del registro: quedan "debitados" (o "rechazados" si vino la multa).
    const chequeIds = new Set(
      fresh.flatMap((r) => [r.chequeId, r.rejectedChequeId]).filter((id): id is string => !!id)
    )
    for (const chequeId of chequeIds) await syncCheque(chequeId)

    await logAudit({
      action: AUDIT_ACTIONS.treasuryImportConfirm,
      entityType: 'treasury_import_batch',
      entityId: batch.id,
      summary: `Importó ${fresh.length} movimientos de ${preview.accountName} (${fileName})`,
      metadata: {
        fileName,
        dateFrom: preview.dateFrom,
        dateTo: preview.dateTo,
        auto: preview.autoCount,
        pending: preview.pendingCount,
        duplicates: preview.duplicateCount,
        balanceBreaks: preview.balanceBreaks,
        chequeMatches: preview.chequeMatches,
        gap: preview.gap,
        closedMonths: preview.closedMonths,
      },
    })
    if (preview.closedMonths.length > 0) {
      const inClosed = fresh.filter((r) => preview.closedMonths.includes(r.txDate.slice(0, 7)))
      await logAudit({
        action: AUDIT_ACTIONS.treasuryClosedMonthImport,
        entityType: 'treasury_import_batch',
        entityId: batch.id,
        summary: `Cargó ${inClosed.length} movimiento${inClosed.length === 1 ? '' : 's'} en ${preview.closedMonths.map(formatMonthLabel).join(', ')} de ${preview.accountName}, que estaba cerrado`,
        metadata: {
          months: preview.closedMonths,
          total: Math.round(inClosed.reduce((a, r) => a + r.amount, 0) * 100) / 100,
        },
      })
    }
    revalidateTreasury()
    return {
      success: `Importados ${fresh.length} movimientos: ${preview.autoCount} clasificados, ${preview.pendingCount} pendientes${preview.chequeMatches ? ` · ${preview.chequeMatches} cheques vinculados` : ''}${linkedCash ? ` · ${linkedCash} movimientos de efectivo vinculados` : ''}`,
      imported: fresh.length,
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al importar' }
  }
}

/** Manda el lote y todos sus movimientos a la papelera. */
export async function deleteImportBatch(batchId: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data: batchTxs } = await supabase
      .from('treasury_transactions')
      .select('account_id, tx_date')
      .eq('import_batch_id', batchId)
      .is('deleted_at', null)
    await assertMonthsOpen((batchTxs ?? []).map((t) => ({ accountId: t.account_id as string, date: t.tx_date as string })))
    const { data: removed, error: txError } = await supabase
      .from('treasury_transactions')
      .update({ deleted_at: now })
      .eq('import_batch_id', batchId)
      .is('deleted_at', null)
      .select('id')
    if (txError) return { error: txError.message }
    // Los cheques que se habían vinculado con estos débitos vuelven a "emitido".
    await syncChequesForTransactions((removed ?? []).map((t) => t.id as string))
    const { data, error } = await supabase
      .from('treasury_import_batches')
      .update({ deleted_at: now })
      .eq('id', batchId)
      .select('file_name')
      .single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryImportDelete,
      entityType: 'treasury_import_batch',
      entityId: batchId,
      entityLabel: data?.file_name ?? undefined,
      summary: `Envió a la papelera la importación ${data?.file_name ?? batchId}`,
    })
    revalidateTreasury()
    revalidatePath('/app/papelera')
    return { success: 'Importación enviada a la papelera' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al borrar la importación' }
  }
}
