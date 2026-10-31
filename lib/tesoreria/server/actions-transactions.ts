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
import { linkedTransactionIds } from './restore'
import { syncCheque, syncChequesForTransactions } from './cheques-sync'
import { isChequeDebit, normalizeChequeNumber } from '../cheques'
import { assertMonthsOpen } from './month-guard'
import { getCategories, getCounterparties, getRules, getTransactions } from './data'
import { classify, isValidRulePattern, manualClassification } from '../engine'
import { isValidCuit, normalizeDescription, roundMoney } from '../text'

const uuid = z.string().uuid()
const scopeSchema = z.enum(['empresa', 'personal']).nullable()

function fail(e: unknown, fallback: string): ActionState {
  return { error: e instanceof Error ? e.message : fallback }
}

// ---------------------------------------------------------------------------
// Re-aplicar reglas a pendientes (el sistema "aprende")
// ---------------------------------------------------------------------------

/** Vuelve a clasificar todos los pendientes con las reglas y contrapartes actuales. */
async function reapplyToPending(): Promise<number> {
  const [pending, rules, counterparties, categories] = await Promise.all([
    getTransactions({ classification: 'pending' }),
    getRules(),
    getCounterparties(),
    getCategories(),
  ])
  const active = categories.filter((c) => c.isActive)
  const supabase = await createClient()
  let updated = 0
  for (const tx of pending) {
    if (tx.source === 'transfer_mirror') continue
    const result = classify(
      {
        descriptionNorm: tx.descriptionNorm,
        amount: tx.amount,
        accountId: tx.accountId,
        counterpartyCuit: tx.counterpartyCuit,
      },
      rules.filter((r) => r.isActive),
      counterparties,
      active
    )
    // Las reglas con cuenta destino crean espejos: sólo se aplican al importar.
    if (result.classification !== 'auto' || result.transferAccountId) continue
    const { error } = await supabase
      .from('treasury_transactions')
      .update({
        category_id: result.categoryId,
        scope: result.scope,
        is_internal: result.isInternal,
        classification: 'auto',
        rule_id: result.ruleId,
      })
      .eq('id', tx.id)
    if (!error) updated++
  }
  return updated
}

export async function reapplyRules(): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const updated = await reapplyToPending()
    await logAudit({
      action: AUDIT_ACTIONS.treasuryRulesReapply,
      summary: `Re-aplicó reglas: ${updated} pendientes clasificados`,
      metadata: { updated },
    })
    revalidateTreasury()
    return { success: updated ? `${updated} pendientes clasificados` : 'No hubo cambios' }
  } catch (e) {
    return fail(e, 'Error al re-aplicar reglas')
  }
}

// ---------------------------------------------------------------------------
// Clasificar (desde Pendientes o Movimientos), opcionalmente creando una regla
// ---------------------------------------------------------------------------

const classifySchema = z.object({
  id: uuid,
  categoryId: uuid.nullable(),
  scope: scopeSchema,
  notes: z.string().max(500).optional(),
  learn: z
    .discriminatedUnion('kind', [
      z.object({
        kind: z.literal('rule'),
        matchType: z.enum(['contains', 'regex']),
        pattern: z.string().min(2).max(200),
        direction: z.enum(['any', 'in', 'out']),
        onlyThisAccount: z.boolean(),
      }),
      z.object({
        kind: z.literal('counterparty'),
        name: z.string().min(1).max(120),
      }),
    ])
    .optional(),
  /** Débito de cheque: a quién fue. Registra (o completa) el cheque en el registro. */
  cheque: z
    .object({
      payeeName: z.string().min(1, '¿A quién fue el cheque?').max(120),
      payeeCuit: z.string().max(11).nullable().optional(),
    })
    .optional(),
})

export type ClassifyInput = z.infer<typeof classifySchema>

export async function classifyTransaction(input: ClassifyInput): Promise<ActionState> {
  try {
    await requireSuperadmin()
    const parsed = classifySchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const { id, categoryId, scope, notes, learn, cheque } = parsed.data

    const supabase = await createClient()
    const { data: tx, error: txError } = await supabase
      .from('treasury_transactions')
      .select('id, account_id, description_raw, description_norm, reference, tx_date, counterparty_cuit, amount, source')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    if (txError || !tx) return { error: 'Movimiento no encontrado' }
    if (tx.source === 'transfer_mirror') {
      return { error: 'Este movimiento es el espejo de una transferencia: editá el original' }
    }

    const categories = await getCategories()
    const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined
    if (categoryId && !category) return { error: 'Categoría inexistente' }
    const result = manualClassification(categoryId, scope, category)

    const { error } = await supabase
      .from('treasury_transactions')
      .update({
        category_id: categoryId,
        scope: result.scope,
        is_internal: result.isInternal,
        classification: result.classification,
        rule_id: null,
        ...(notes !== undefined && { notes: notes || null }),
      })
      .eq('id', id)
    if (error) return { error: error.message }

    // Débito de cheque: el beneficiario se completa acá y el cheque queda registrado y vinculado.
    let chequeNote = ''
    if (cheque && isChequeDebit(tx.description_norm as string, Number(tx.amount))) {
      const number = normalizeChequeNumber(tx.reference as string)
      if (!number) return { error: 'El extracto no trae el número de este cheque: registralo desde Cheques' }
      const cuit = cheque.payeeCuit?.replace(/\D/g, '') || null
      if (cuit && !isValidCuit(cuit)) return { error: 'El CUIT del beneficiario no es válido' }
      const { data: existing } = await supabase
        .from('treasury_cheques')
        .select('id')
        .eq('account_id', tx.account_id)
        .eq('cheque_number', number)
        .is('deleted_at', null)
        .maybeSingle()
      const payload = {
        payee_name: cheque.payeeName.trim(),
        payee_cuit: cuit,
        category_id: categoryId,
        scope: result.scope,
        ...(notes ? { notes } : {}),
      }
      const write = existing
        ? await supabase.from('treasury_cheques').update(payload).eq('id', existing.id).select('id').single()
        : await supabase
            .from('treasury_cheques')
            .insert({
              ...payload,
              account_id: tx.account_id,
              cheque_number: number,
              amount: Math.abs(Number(tx.amount)),
              payment_date: tx.tx_date,
              status: 'debitado',
              transaction_id: id,
            })
            .select('id')
            .single()
      if (write.error) return { error: `Se clasificó, pero no se pudo registrar el cheque: ${write.error.message}` }
      await supabase
        .from('treasury_transactions')
        .update({ notes: `Cheque N° ${number} · ${payload.payee_name}${notes ? ` · ${notes}` : ''}` })
        .eq('id', id)
      if (existing) await syncCheque(existing.id as string)
      await logAudit({
        action: AUDIT_ACTIONS.treasuryChequeUpsert,
        entityType: 'treasury_cheque',
        entityId: write.data.id,
        entityLabel: `Cheque N° ${number}`,
        summary: `Registró desde Pendientes el cheque N° ${number} a ${payload.payee_name}`,
      })
      chequeNote = ` · cheque N° ${number} registrado a ${payload.payee_name}`
    }

    let learned = ''
    if (learn && categoryId) {
      if (learn.kind === 'rule') {
        if (!isValidRulePattern(learn.matchType, learn.pattern)) {
          return { error: 'El patrón de la regla no es válido' }
        }
        const { data: rule, error: ruleError } = await supabase
          .from('treasury_rules')
          .insert({
            name: learn.pattern,
            match_type: learn.matchType,
            pattern: learn.matchType === 'contains' ? normalizeDescription(learn.pattern) : learn.pattern,
            direction: learn.direction,
            account_id: learn.onlyThisAccount ? tx.account_id : null,
            category_id: categoryId,
            scope: result.isInternal ? null : result.scope,
            priority: 80,
            created_from_transaction_id: id,
          })
          .select('id')
          .single()
        if (ruleError) return { error: `Se clasificó, pero no se pudo crear la regla: ${ruleError.message}` }
        await logAudit({
          action: AUDIT_ACTIONS.treasuryRuleUpsert,
          entityType: 'treasury_rule',
          entityId: rule.id,
          summary: `Creó la regla "${learn.pattern}" → ${category?.name}`,
        })
      } else {
        if (!tx.counterparty_cuit) return { error: 'El movimiento no tiene CUIT para guardar la contraparte' }
        const { error: cpError } = await supabase.from('treasury_counterparties').insert({
          cuit: tx.counterparty_cuit,
          name: learn.name,
          category_id: categoryId,
          scope: result.isInternal ? null : result.scope,
        })
        if (cpError) {
          return {
            error: cpError.message.includes('duplicate')
              ? 'Ese CUIT ya está en Contrapartes: editalo desde Configuración'
              : cpError.message,
          }
        }
        await logAudit({
          action: AUDIT_ACTIONS.treasuryCounterpartyUpsert,
          entityType: 'treasury_counterparty',
          summary: `Agregó la contraparte ${learn.name} (${tx.counterparty_cuit}) → ${category?.name}`,
        })
      }
      const updated = await reapplyToPending()
      learned = updated ? ` · ${updated} pendientes más se clasificaron solos` : ''
    }

    await logAudit({
      action: AUDIT_ACTIONS.treasuryTransactionClassify,
      entityType: 'treasury_transaction',
      entityId: id,
      summary: `Clasificó "${tx.description_raw}" como ${category?.name ?? 'sin categoría'}${result.scope ? ` (${result.scope})` : ''}`,
      metadata: { amount: Number(tx.amount) },
    })
    revalidateTreasury()
    return { success: `Movimiento clasificado${chequeNote}${learned}` }
  } catch (e) {
    return fail(e, 'Error al clasificar')
  }
}

// ---------------------------------------------------------------------------
// Carga manual (efectivo u otros) y transferencias entre cuentas propias
// ---------------------------------------------------------------------------

const manualSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.enum(['income', 'expense']),
    accountId: uuid,
    txDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    description: z.string().min(1, 'Descripción requerida').max(300),
    amount: z.number().positive('El monto tiene que ser mayor a 0'),
    categoryId: uuid.nullable(),
    scope: scopeSchema,
    notes: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal('transfer'),
    accountId: uuid,
    toAccountId: uuid,
    txDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    description: z.string().min(1, 'Descripción requerida').max(300),
    amount: z.number().positive('El monto tiene que ser mayor a 0'),
    notes: z.string().max(500).optional(),
  }),
])

export type ManualTransactionInput = z.infer<typeof manualSchema>

export async function createManualTransaction(input: ManualTransactionInput): Promise<ActionState> {
  try {
    const session = await requireSuperadmin()
    const parsed = manualSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const data = parsed.data
    const supabase = await createClient()
    const amount = roundMoney(data.amount)

    await assertMonthsOpen([
      { accountId: data.accountId, date: data.txDate },
      ...(data.type === 'transfer' ? [{ accountId: data.toAccountId, date: data.txDate }] : []),
    ])

    if (data.type === 'transfer') {
      if (data.accountId === data.toAccountId) return { error: 'Elegí dos cuentas distintas' }
      const categories = await getCategories()
      const internal =
        categories.find((c) => c.kind === 'internal' && c.name.toLowerCase().includes('transferencia')) ??
        categories.find((c) => c.kind === 'internal')
      const outId = randomUUID()
      const inId = randomUUID()
      const common = {
        tx_date: data.txDate,
        description_raw: data.description,
        description_norm: normalizeDescription(data.description),
        category_id: internal?.id ?? null,
        scope: null,
        is_internal: true,
        classification: 'manual',
        notes: data.notes || null,
        created_by: session.user.id,
      }
      const { error } = await supabase.from('treasury_transactions').insert([
        { ...common, id: outId, account_id: data.accountId, source: 'manual', amount: -amount, transfer_pair_id: inId },
        { ...common, id: inId, account_id: data.toAccountId, source: 'transfer_mirror', amount, transfer_pair_id: outId },
      ])
      if (error) return { error: error.message }
      await logAudit({
        action: AUDIT_ACTIONS.treasuryTransactionCreate,
        entityType: 'treasury_transaction',
        entityId: outId,
        summary: `Registró una transferencia interna de $${amount.toLocaleString('es-AR')}: ${data.description}`,
      })
      revalidateTreasury()
      return { success: 'Transferencia registrada' }
    }

    const categories = await getCategories()
    const category = data.categoryId ? categories.find((c) => c.id === data.categoryId) : undefined
    const result = manualClassification(data.categoryId, data.scope, category)
    const id = randomUUID()
    const { error } = await supabase.from('treasury_transactions').insert({
      id,
      account_id: data.accountId,
      source: 'manual',
      tx_date: data.txDate,
      description_raw: data.description,
      description_norm: normalizeDescription(data.description),
      amount: data.type === 'income' ? amount : -amount,
      category_id: data.categoryId,
      scope: result.scope,
      is_internal: result.isInternal,
      classification: result.classification,
      notes: data.notes || null,
      created_by: session.user.id,
    })
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryTransactionCreate,
      entityType: 'treasury_transaction',
      entityId: id,
      summary: `Cargó a mano ${data.type === 'income' ? 'un ingreso' : 'un egreso'} de $${amount.toLocaleString('es-AR')}: ${data.description}`,
    })
    revalidateTreasury()
    return { success: 'Movimiento cargado' }
  } catch (e) {
    return fail(e, 'Error al cargar el movimiento')
  }
}

// ---------------------------------------------------------------------------
// Transferencia interna sugerida (par egreso/ingreso entre cuentas propias)
// ---------------------------------------------------------------------------

export async function confirmInternalPair(outId: string, inId: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(outId).success || !uuid.safeParse(inId).success) return { error: 'Datos inválidos' }
    const categories = await getCategories()
    const internal =
      categories.find((c) => c.kind === 'internal' && c.name.toLowerCase().includes('transferencia')) ??
      categories.find((c) => c.kind === 'internal')
    const supabase = await createClient()
    const base = {
      category_id: internal?.id ?? null,
      scope: null,
      is_internal: true,
      classification: 'manual',
      rule_id: null,
    }
    const a = await supabase.from('treasury_transactions').update({ ...base, transfer_pair_id: inId }).eq('id', outId)
    if (a.error) return { error: a.error.message }
    const b = await supabase.from('treasury_transactions').update({ ...base, transfer_pair_id: outId }).eq('id', inId)
    if (b.error) return { error: b.error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryInternalPair,
      entityType: 'treasury_transaction',
      entityId: outId,
      summary: 'Marcó dos movimientos como transferencia entre cuentas propias',
      metadata: { outId, inId },
    })
    revalidateTreasury()
    return { success: 'Marcados como transferencia interna' }
  } catch (e) {
    return fail(e, 'Error al marcar la transferencia')
  }
}

// ---------------------------------------------------------------------------
// Papelera de movimientos (borra y restaura junto con su espejo)
// ---------------------------------------------------------------------------

export async function deleteTransaction(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(id).success) return { error: 'Datos inválidos' }
    const ids = await linkedTransactionIds(id)
    const supabase = await createClient()
    const { data: affected } = await supabase.from('treasury_transactions').select('account_id, tx_date').in('id', ids)
    await assertMonthsOpen((affected ?? []).map((t) => ({ accountId: t.account_id as string, date: t.tx_date as string })))
    const { data, error } = await supabase
      .from('treasury_transactions')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
      .select('description_raw, amount')
    if (error) return { error: error.message }
    await syncChequesForTransactions(ids)
    await logAudit({
      action: AUDIT_ACTIONS.treasuryTransactionDelete,
      entityType: 'treasury_transaction',
      entityId: id,
      entityLabel: data?.[0]?.description_raw ?? undefined,
      summary: `Envió a la papelera "${data?.[0]?.description_raw ?? id}"`,
      metadata: { ids },
    })
    revalidateTreasury()
    revalidatePath('/app/papelera')
    return { success: 'Movimiento enviado a la papelera' }
  } catch (e) {
    return fail(e, 'Error al borrar')
  }
}
