'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import type { ActionState } from '@/lib/validations/parse-form'
import { revalidateTreasury } from './revalidate'
import { isValidCuit, roundMoney } from '../text'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
const money = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

const schema = z.object({
  id: uuid.optional(),
  chequeNumber: z.string().min(1, 'Número requerido').max(30),
  bankName: z.string().max(80).nullable(),
  issuerName: z.string().min(1, '¿Quién lo libró?').max(120),
  issuerCuit: z.string().max(11).nullable(),
  amount: z.number().positive('El monto tiene que ser mayor a 0'),
  receivedDate: isoDate.nullable(),
  paymentDate: isoDate.nullable(),
  status: z.enum(['cartera', 'depositado', 'descontado', 'endosado', 'rechazado']),
  endorsedTo: z.string().max(120).nullable(),
  notes: z.string().max(500).nullable(),
})

export type ReceivedChequeInput = z.infer<typeof schema>

export async function upsertReceivedCheque(input: ReceivedChequeInput): Promise<ActionState> {
  try {
    const session = await requireSuperadmin()
    const parsed = schema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    const cuit = d.issuerCuit?.replace(/\D/g, '') || null
    if (cuit && !isValidCuit(cuit)) return { error: 'El CUIT del librador no es válido' }
    if (d.status === 'endosado' && !d.endorsedTo?.trim()) return { error: '¿A quién se endosó?' }
    const payload = {
      cheque_number: d.chequeNumber.replace(/\D/g, '') || d.chequeNumber.trim(),
      bank_name: d.bankName?.trim() || null,
      issuer_name: d.issuerName.trim(),
      issuer_cuit: cuit,
      amount: roundMoney(d.amount),
      received_date: d.receivedDate,
      payment_date: d.paymentDate,
      status: d.status,
      endorsed_to: d.status === 'endosado' ? d.endorsedTo?.trim() ?? null : null,
      notes: d.notes?.trim() || null,
    }
    const supabase = await createClient()
    const { data, error } = d.id
      ? await supabase.from('treasury_received_cheques').update(payload).eq('id', d.id).select('id').single()
      : await supabase.from('treasury_received_cheques').insert({ ...payload, created_by: session.user.id }).select('id').single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryReceivedChequeUpsert,
      entityType: 'treasury_received_cheque',
      entityId: data.id,
      entityLabel: `Cheque N° ${payload.cheque_number}`,
      summary: `${d.id ? 'Actualizó' : 'Registró'} el cheque recibido N° ${payload.cheque_number} de ${payload.issuer_name} por ${money(payload.amount)}`,
    })
    revalidateTreasury()
    return { success: 'Cheque recibido guardado' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al guardar' }
  }
}

/**
 * Vincula uno o más cheques recibidos con el crédito del banco que los liquidó:
 * un depósito, o un descuento (ej. "CCERR OVER CASH"). Para descuentos, la diferencia
 * entre el valor de los cheques y lo acreditado es el costo financiero.
 */
export async function settleReceivedCheques(
  chequeIds: string[],
  transactionId: string,
  kind: 'depositado' | 'descontado'
): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (chequeIds.length === 0 || !chequeIds.every((id) => uuid.safeParse(id).success) || !uuid.safeParse(transactionId).success) {
      return { error: 'Elegí los cheques y el crédito del banco' }
    }
    const supabase = await createClient()
    const { data: tx } = await supabase
      .from('treasury_transactions')
      .select('amount, tx_date, description_raw')
      .eq('id', transactionId)
      .is('deleted_at', null)
      .single()
    if (!tx || Number(tx.amount) <= 0) return { error: 'Elegí un crédito (ingreso) del banco' }
    const { data: cheques, error: chError } = await supabase
      .from('treasury_received_cheques')
      .select('id, amount, status')
      .in('id', chequeIds)
      .is('deleted_at', null)
    if (chError) return { error: chError.message }
    if ((cheques ?? []).some((c) => c.status !== 'cartera')) return { error: 'Sólo se pueden liquidar cheques en cartera' }
    const face = roundMoney((cheques ?? []).reduce((a, c) => a + Number(c.amount), 0))
    const credited = Number(tx.amount)
    if (kind === 'depositado' && Math.abs(face - credited) > 0.01) {
      return { error: `El depósito acreditó ${money(credited)} y los cheques suman ${money(face)}` }
    }
    if (kind === 'descontado' && credited > face + 0.01) {
      return { error: `Lo acreditado (${money(credited)}) supera el valor de los cheques (${money(face)})` }
    }

    const { error } = await supabase
      .from('treasury_received_cheques')
      .update({ status: kind, settlement_transaction_id: transactionId })
      .in('id', chequeIds)
    if (error) return { error: error.message }

    const cost = roundMoney(face - credited)
    await logAudit({
      action: AUDIT_ACTIONS.treasuryReceivedChequeSettle,
      entityType: 'treasury_received_cheque',
      entityId: chequeIds[0],
      summary:
        kind === 'descontado'
          ? `Descontó ${chequeIds.length} cheque${chequeIds.length === 1 ? '' : 's'} por ${money(face)}: se acreditaron ${money(credited)} (costo ${money(cost)})`
          : `Depositó ${chequeIds.length} cheque${chequeIds.length === 1 ? '' : 's'} por ${money(face)}`,
      metadata: { chequeIds, transactionId, face, credited, cost },
    })
    revalidateTreasury()
    return {
      success:
        kind === 'descontado'
          ? `Descuento registrado: el costo fue ${money(cost)} (${face ? ((cost / face) * 100).toFixed(2) : '0'}% del valor)`
          : 'Depósito registrado',
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al registrar' }
  }
}

/** Vuelve a cartera (deshace un depósito/descuento mal vinculado). */
export async function unsettleReceivedCheque(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(id).success) return { error: 'Datos inválidos' }
    const supabase = await createClient()
    const { error } = await supabase
      .from('treasury_received_cheques')
      .update({ status: 'cartera', settlement_transaction_id: null })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidateTreasury()
    return { success: 'El cheque volvió a cartera' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al actualizar' }
  }
}

export async function deleteReceivedCheque(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(id).success) return { error: 'Datos inválidos' }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('treasury_received_cheques')
      .update(softDeleteUpdate())
      .eq('id', id)
      .select('cheque_number, issuer_name')
      .single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryReceivedChequeDelete,
      entityType: 'treasury_received_cheque',
      entityId: id,
      entityLabel: `Cheque N° ${data.cheque_number}`,
      summary: `Envió a la papelera el cheque recibido N° ${data.cheque_number} (${data.issuer_name})`,
    })
    revalidateTreasury()
    revalidatePath('/app/papelera')
    return { success: 'Cheque enviado a la papelera' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al borrar' }
  }
}
