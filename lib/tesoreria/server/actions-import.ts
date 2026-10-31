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
  getRules,
} from './data'
import { parseStatement, providerLabel } from '../parsers'
import { buildDedupKeys, classify, countBalanceBreaks } from '../engine'
import { extractCuit, normalizeDescription } from '../text'
import type { ImportPreview, ImportPreviewRow, SheetCell } from '../types'

const cellsSchema = z
  .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).max(60))
  .max(20000)

async function buildPreview(fileName: string, rawCells: unknown): Promise<ImportPreview> {
  const parsedCells = cellsSchema.safeParse(rawCells)
  if (!parsedCells.success) throw new Error('El archivo no tiene un formato de planilla válido')
  const cells = parsedCells.data as SheetCell[][]

  const statement = parseStatement(cells)
  if (statement.rows.length === 0) throw new Error('El extracto no tiene movimientos')

  const accounts = await getAccounts(false)
  const account = accounts.find((a) => a.provider === statement.provider)
  if (!account) {
    throw new Error(`No hay una cuenta activa configurada para ${providerLabel(statement.provider)}`)
  }

  const [rules, counterparties, categories] = await Promise.all([
    getRules(),
    getCounterparties(),
    getCategories(),
  ])
  const activeCategories = categories.filter((c) => c.isActive)
  const activeRules = rules.filter(
    (r) => r.isActive && (!r.categoryId || activeCategories.some((c) => c.id === r.categoryId))
  )

  const keys = buildDedupKeys(statement.rows)
  const existing = await getExistingDedupKeys(account.id, keys)

  const rows: ImportPreviewRow[] = statement.rows.map((row, i) => {
    const descriptionNorm = normalizeDescription(row.description)
    const counterpartyCuit = extractCuit(row.description)
    return {
      ...row,
      descriptionNorm,
      counterpartyCuit,
      dedupKey: keys[i],
      isDuplicate: existing.has(keys[i]),
      result: classify(
        { descriptionNorm, amount: row.amount, accountId: account.id, counterpartyCuit },
        activeRules,
        counterparties,
        activeCategories
      ),
    }
  })

  const fresh = rows.filter((r) => !r.isDuplicate)
  const dates = statement.rows.map((r) => r.txDate).sort()
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
    errors: statement.errors,
  }
}

/** Paso 1: leer, detectar banco, deduplicar y clasificar. No escribe nada. */
export async function previewTreasuryImport(
  fileName: string,
  cells: unknown
): Promise<{ preview?: ImportPreview; error?: string }> {
  try {
    await requireSuperadmin()
    return { preview: await buildPreview(fileName, cells) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al leer el extracto' }
  }
}

/** Paso 2: vuelve a calcular la vista previa en el servidor y guarda sólo los nuevos. */
export async function confirmTreasuryImport(
  fileName: string,
  cells: unknown
): Promise<ActionState & { imported?: number }> {
  try {
    const session = await requireSuperadmin()
    const preview = await buildPreview(fileName, cells)
    const fresh = preview.rows.filter((r) => !r.isDuplicate)
    if (fresh.length === 0) return { error: 'No hay movimientos nuevos: todo el extracto ya estaba cargado' }

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
          created_by: session.user.id,
        })
      }
    }

    for (let i = 0; i < inserts.length; i += 500) {
      const { error } = await supabase.from('treasury_transactions').insert(inserts.slice(i, i + 500))
      if (error) {
        // Sin transacciones en el cliente de Supabase: deshacemos el lote a mano.
        await supabase.from('treasury_transactions').delete().eq('import_batch_id', batch.id)
        await supabase.from('treasury_import_batches').delete().eq('id', batch.id)
        return { error: `No se pudo guardar el extracto: ${error.message}` }
      }
    }

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
      },
    })
    revalidateTreasury()
    return {
      success: `Importados ${fresh.length} movimientos: ${preview.autoCount} clasificados, ${preview.pendingCount} pendientes`,
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
    const { error: txError } = await supabase
      .from('treasury_transactions')
      .update({ deleted_at: now })
      .eq('import_batch_id', batchId)
      .is('deleted_at', null)
    if (txError) return { error: txError.message }
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
