'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import type { ActionState } from '@/lib/validations/parse-form'
import { revalidateTreasury } from './revalidate'
import { getAccounts, getCashCounts, getCategories, getMonthCloses, getTransactions } from './data'
import { assertMonthsOpen } from './month-guard'
import { buildCloseRows, systemBalanceAt } from '../closing'
import { formatMonthLabel } from '../closing-labels'
import { normalizeDescription, roundMoney } from '../text'

const uuid = z.string().uuid()
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Mes inválido')
const money = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

function fail(e: unknown, fallback: string): ActionState {
  return { error: e instanceof Error ? e.message : fallback }
}

/** Cierra un mes de una cuenta guardando la foto de saldos y pendientes de ese momento. */
export async function closeMonth(accountId: string, month: string, notes?: string): Promise<ActionState> {
  try {
    const session = await requireSuperadmin()
    if (!uuid.safeParse(accountId).success || !monthSchema.safeParse(month).success) return { error: 'Datos inválidos' }
    const [accounts, txs, closes, counts] = await Promise.all([
      getAccounts(),
      getTransactions({ accountId }),
      getMonthCloses(),
      getCashCounts(),
    ])
    const account = accounts.find((a) => a.id === accountId)
    if (!account) return { error: 'Cuenta no encontrada' }
    const [row] = buildCloseRows([account], txs, closes, counts, [month])
    if (row.close) return { error: `${formatMonthLabel(month)} ya está cerrado` }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('treasury_month_closes')
      .insert({
        account_id: accountId,
        month: `${month}-01`,
        system_balance: row.systemBalance,
        bank_balance: row.referenceBalance,
        difference: row.difference,
        pending_count: row.pendingCount,
        notes: notes?.trim() || null,
        closed_by: session.user.id,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }

    await logAudit({
      action: AUDIT_ACTIONS.treasuryMonthClose,
      entityType: 'treasury_month_close',
      entityId: data.id,
      entityLabel: `${account.name} · ${formatMonthLabel(month)}`,
      summary: `Cerró ${formatMonthLabel(month)} de ${account.name} con saldo ${money(row.systemBalance)}${row.difference ? ` (diferencia con el banco ${money(row.difference)})` : ''}`,
      metadata: { ...row, close: undefined },
    })
    revalidateTreasury()
    return { success: `${formatMonthLabel(month)} de ${account.name} cerrado` }
  } catch (e) {
    return fail(e, 'Error al cerrar el mes')
  }
}

export async function reopenMonth(closeId: string, reason: string): Promise<ActionState> {
  try {
    const session = await requireSuperadmin()
    if (!uuid.safeParse(closeId).success) return { error: 'Datos inválidos' }
    if (reason.trim().length < 3) return { error: 'Contá brevemente por qué se reabre' }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('treasury_month_closes')
      .update({ status: 'reopened', reopened_by: session.user.id, reopened_at: new Date().toISOString(), reopen_reason: reason.trim() })
      .eq('id', closeId)
      .eq('status', 'closed')
      .select('month, treasury_accounts(name)')
      .single()
    if (error || !data) return { error: error?.message ?? 'El mes no está cerrado' }
    const month = String(data.month).slice(0, 7)
    const accountRel = data.treasury_accounts as { name: string } | { name: string }[] | null
    const accountName = Array.isArray(accountRel) ? accountRel[0]?.name : accountRel?.name
    await logAudit({
      action: AUDIT_ACTIONS.treasuryMonthReopen,
      entityType: 'treasury_month_close',
      entityId: closeId,
      entityLabel: `${accountName ?? ''} · ${formatMonthLabel(month)}`,
      summary: `Reabrió ${formatMonthLabel(month)} de ${accountName ?? 'la cuenta'}: ${reason.trim()}`,
    })
    revalidateTreasury()
    return { success: `${formatMonthLabel(month)} reabierto` }
  } catch (e) {
    return fail(e, 'Error al reabrir el mes')
  }
}

// ---------------------------------------------------------------------------
// Arqueo de efectivo
// ---------------------------------------------------------------------------

const cashCountSchema = z.object({
  accountId: uuid,
  countDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  countedAmount: z.number().finite().min(0, 'El efectivo contado no puede ser negativo'),
  notes: z.string().max(500).optional(),
  registerAdjustment: z.boolean(),
})

export async function createCashCount(input: z.infer<typeof cashCountSchema>): Promise<ActionState> {
  try {
    const session = await requireSuperadmin()
    const parsed = cashCountSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    const [accounts, txs, categories] = await Promise.all([
      getAccounts(),
      getTransactions({ accountId: d.accountId }),
      getCategories(),
    ])
    const account = accounts.find((a) => a.id === d.accountId)
    if (!account || account.kind !== 'cash') return { error: 'El arqueo es sólo para la cuenta de efectivo' }

    const counted = roundMoney(d.countedAmount)
    const system = systemBalanceAt(account, txs, d.countDate)
    const difference = roundMoney(counted - system)
    const supabase = await createClient()

    let adjustmentId: string | null = null
    if (d.registerAdjustment && Math.abs(difference) > 0.009) {
      await assertMonthsOpen([{ accountId: d.accountId, date: d.countDate }])
      const category = categories.find((c) => c.name.toLowerCase() === 'diferencias de caja')
      adjustmentId = randomUUID()
      const [y, m, dd] = d.countDate.split('-')
      const description = `${difference < 0 ? 'Faltante' : 'Sobrante'} de arqueo ${dd}/${m}/${y}`
      const { error } = await supabase.from('treasury_transactions').insert({
        id: adjustmentId,
        account_id: d.accountId,
        source: 'manual',
        tx_date: d.countDate,
        description_raw: description,
        description_norm: normalizeDescription(description),
        amount: difference,
        category_id: category?.id ?? null,
        scope: category ? 'empresa' : null,
        classification: category ? 'manual' : 'pending',
        notes: d.notes?.trim() || null,
        created_by: session.user.id,
      })
      if (error) return { error: error.message }
    }

    const { data, error } = await supabase
      .from('treasury_cash_counts')
      .insert({
        account_id: d.accountId,
        count_date: d.countDate,
        counted_amount: counted,
        system_amount: system,
        difference,
        adjustment_transaction_id: adjustmentId,
        notes: d.notes?.trim() || null,
        created_by: session.user.id,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }

    await logAudit({
      action: AUDIT_ACTIONS.treasuryCashCount,
      entityType: 'treasury_cash_count',
      entityId: data.id,
      summary: `Arqueo de efectivo del ${d.countDate}: contado ${money(counted)}, sistema ${money(system)}, diferencia ${money(difference)}${adjustmentId ? ' (ajuste registrado)' : ''}`,
      metadata: { counted, system, difference, adjustmentId },
    })
    revalidateTreasury()
    if (Math.abs(difference) <= 0.009) return { success: 'Arqueo guardado: el efectivo coincide con el sistema' }
    return {
      success: `Arqueo guardado. ${difference < 0 ? 'Faltan' : 'Sobran'} ${money(Math.abs(difference))}${adjustmentId ? ' y se registró el ajuste' : ''}.`,
    }
  } catch (e) {
    return fail(e, 'Error al guardar el arqueo')
  }
}

export async function deleteCashCount(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(id).success) return { error: 'Datos inválidos' }
    const supabase = await createClient()
    const { data: count } = await supabase
      .from('treasury_cash_counts')
      .select('account_id, count_date, adjustment_transaction_id')
      .eq('id', id)
      .single()
    if (!count) return { error: 'Arqueo no encontrado' }
    const now = new Date().toISOString()
    if (count.adjustment_transaction_id) {
      await assertMonthsOpen([{ accountId: count.account_id as string, date: count.count_date as string }])
      await supabase.from('treasury_transactions').update({ deleted_at: now }).eq('id', count.adjustment_transaction_id)
    }
    const { error } = await supabase.from('treasury_cash_counts').update({ deleted_at: now }).eq('id', id)
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryCashCountDelete,
      entityType: 'treasury_cash_count',
      entityId: id,
      summary: `Envió a la papelera el arqueo del ${count.count_date}${count.adjustment_transaction_id ? ' y su ajuste' : ''}`,
    })
    revalidateTreasury()
    revalidatePath('/app/papelera')
    return { success: 'Arqueo enviado a la papelera' }
  } catch (e) {
    return fail(e, 'Error al borrar el arqueo')
  }
}

