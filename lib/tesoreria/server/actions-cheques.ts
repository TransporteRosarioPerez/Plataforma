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
import { syncCheque } from './cheques-sync'
import { normalizeChequeNumber } from '../cheques'
import { isValidCuit, roundMoney } from '../text'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

const chequeSchema = z.object({
  id: uuid.optional(),
  accountId: uuid,
  chequeNumber: z.string().min(1, 'Número de cheque requerido').max(30),
  amount: z.number().positive('El monto tiene que ser mayor a 0'),
  issueDate: isoDate.nullable(),
  paymentDate: isoDate.nullable(),
  payeeName: z.string().min(1, '¿A quién se le dio el cheque?').max(120),
  payeeCuit: z.string().max(11).nullable(),
  categoryId: uuid.nullable(),
  scope: z.enum(['empresa', 'personal']).nullable(),
  notes: z.string().max(500).nullable(),
})

export type ChequeInput = z.infer<typeof chequeSchema>

function money(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

export async function upsertCheque(input: ChequeInput): Promise<ActionState> {
  try {
    const session = await requireSuperadmin()
    const parsed = chequeSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }
    const d = parsed.data
    const number = normalizeChequeNumber(d.chequeNumber)
    if (!number) return { error: 'El número de cheque tiene que tener dígitos' }
    const cuit = d.payeeCuit?.replace(/\D/g, '') || null
    if (cuit && !isValidCuit(cuit)) return { error: 'El CUIT del beneficiario no es válido' }

    const payload = {
      account_id: d.accountId,
      cheque_number: number,
      amount: roundMoney(d.amount),
      issue_date: d.issueDate,
      payment_date: d.paymentDate,
      payee_name: d.payeeName.trim(),
      payee_cuit: cuit,
      category_id: d.categoryId,
      scope: d.scope,
      notes: d.notes?.trim() || null,
    }
    const supabase = await createClient()
    const { data, error } = d.id
      ? await supabase.from('treasury_cheques').update(payload).eq('id', d.id).select('id').single()
      : await supabase
          .from('treasury_cheques')
          .insert({ ...payload, created_by: session.user.id })
          .select('id')
          .single()
    if (error) {
      return {
        error: error.message.includes('duplicate')
          ? `Ya hay un cheque N° ${number} registrado en esa cuenta`
          : error.message,
      }
    }

    const sync = await syncCheque(data.id)
    await logAudit({
      action: AUDIT_ACTIONS.treasuryChequeUpsert,
      entityType: 'treasury_cheque',
      entityId: data.id,
      entityLabel: `Cheque N° ${number}`,
      summary: `${d.id ? 'Actualizó' : 'Registró'} el cheque N° ${number} a ${payload.payee_name} por ${money(payload.amount)}`,
      metadata: { status: sync?.status, linkedTransactionId: sync?.linkedTransactionId },
    })
    revalidateTreasury()

    if (sync?.amountMismatch !== null && sync?.amountMismatch !== undefined) {
      return {
        success: `Cheque guardado. Ojo: el banco debitó el N° ${number} por ${money(sync.amountMismatch)}, no por ${money(payload.amount)}. Revisá el monto.`,
      }
    }
    if (sync?.linkedTransactionId) return { success: 'Cheque guardado y vinculado con su débito en el banco' }
    if (sync?.status === 'rechazado') return { success: 'Cheque guardado. Figura una multa por rechazo de este cheque.' }
    return { success: 'Cheque guardado. Se va a vincular solo cuando se importe el débito.' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al guardar el cheque' }
  }
}

/** Anular (no se va a cobrar) o volver a dejarlo vigente. */
export async function setChequeVoided(id: string, voided: boolean): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(id).success) return { error: 'Datos inválidos' }
    const supabase = await createClient()
    const { data: cheque } = await supabase
      .from('treasury_cheques')
      .select('cheque_number, status')
      .eq('id', id)
      .single()
    if (!cheque) return { error: 'Cheque no encontrado' }
    if (voided && cheque.status === 'debitado') return { error: 'No se puede anular: el banco ya lo debitó' }

    const { error } = await supabase
      .from('treasury_cheques')
      .update({ status: voided ? 'anulado' : 'emitido' })
      .eq('id', id)
    if (error) return { error: error.message }
    if (!voided) await syncCheque(id)

    await logAudit({
      action: AUDIT_ACTIONS.treasuryChequeStatus,
      entityType: 'treasury_cheque',
      entityId: id,
      entityLabel: `Cheque N° ${cheque.cheque_number}`,
      summary: voided ? `Anuló el cheque N° ${cheque.cheque_number}` : `Reactivó el cheque N° ${cheque.cheque_number}`,
    })
    revalidateTreasury()
    return { success: voided ? 'Cheque anulado' : 'Cheque reactivado' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al actualizar el cheque' }
  }
}

export async function deleteCheque(id: string): Promise<ActionState> {
  try {
    await requireSuperadmin()
    if (!uuid.safeParse(id).success) return { error: 'Datos inválidos' }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('treasury_cheques')
      .update({ ...softDeleteUpdate(), transaction_id: null })
      .eq('id', id)
      .select('cheque_number, payee_name')
      .single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.treasuryChequeDelete,
      entityType: 'treasury_cheque',
      entityId: id,
      entityLabel: `Cheque N° ${data.cheque_number}`,
      summary: `Envió a la papelera el cheque N° ${data.cheque_number} (${data.payee_name})`,
    })
    revalidateTreasury()
    revalidatePath('/app/papelera')
    return { success: 'Cheque enviado a la papelera. Podés recuperarlo desde Papelera.' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al borrar el cheque' }
  }
}
