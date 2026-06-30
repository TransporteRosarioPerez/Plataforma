'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { arcorClientSchema } from '@/lib/validations/arcor-clients'

async function findArcorClientByAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  excludeId?: string
) {
  let query = supabase
    .from('arcor_clients')
    .select('id, deleted_at')
    .eq('account_id', accountId)

  if (excludeId) query = query.neq('id', excludeId)

  const { data } = await query.maybeSingle()
  return data as { id: string; deleted_at: string | null } | null
}

export async function upsertArcorClient(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(arcorClientSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()
  const accountId = parsed.data.account_id?.trim() || null

  const row = {
    name: parsed.data.name.trim(),
    account_id: accountId,
    address: parsed.data.address?.trim() || null,
  }

  const existingByAccountId =
    accountId && !parsed.data.id
      ? await findArcorClientByAccountId(supabase, accountId)
      : null

  if (accountId && parsed.data.id) {
    const conflict = await findArcorClientByAccountId(supabase, accountId, parsed.data.id)
    if (conflict && !conflict.deleted_at) {
      return { error: 'Ya existe una cuenta con ese número de cliente' }
    }
  } else if (existingByAccountId && !existingByAccountId.deleted_at) {
    return { error: 'Ya existe una cuenta con ese número de cliente' }
  }

  if (parsed.data.id) {
    const { error } = await supabase.from('arcor_clients').update(row).eq('id', parsed.data.id)
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.arcorClientUpsert,
      entityType: 'arcor_client',
      entityId: parsed.data.id,
      entityLabel: row.name,
      summary: `Actualizó la cuenta de viaje ${row.name}`,
    })
  } else if (existingByAccountId?.deleted_at) {
    const { error } = await supabase
      .from('arcor_clients')
      .update({ ...row, deleted_at: null })
      .eq('id', existingByAccountId.id)
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.arcorClientUpsert,
      entityType: 'arcor_client',
      entityId: existingByAccountId.id,
      entityLabel: row.name,
      summary: `Recuperó la cuenta de viaje ${row.name} (${accountId})`,
    })
  } else {
    const { data, error } = await supabase.from('arcor_clients').insert(row).select('id').single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.arcorClientUpsert,
      entityType: 'arcor_client',
      entityId: data.id,
      entityLabel: row.name,
      summary: `Creó la cuenta de viaje ${row.name}`,
    })
  }

  revalidatePath('/app/cuentas-viaje')
  revalidatePath('/app/viajes')
  revalidatePath('/app/papelera')
  return {
    success: parsed.data.id
      ? 'Cuenta actualizada'
      : existingByAccountId?.deleted_at
        ? 'Cuenta recuperada del catálogo'
        : 'Cuenta creada',
  }
}

export async function deleteArcorClient(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: client } = await supabase.from('arcor_clients').select('name').eq('id', id).single()

  const { error } = await supabase
    .from('arcor_clients')
    .update(softDeleteUpdate())
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.arcorClientDelete,
    entityType: 'arcor_client',
    entityId: id,
    entityLabel: client?.name ?? undefined,
    summary: `Eliminó la cuenta de viaje ${client?.name ?? id}`,
  })

  revalidatePath('/app/cuentas-viaje')
  revalidatePath('/app/viajes')
  revalidatePath('/app/papelera')
  return { success: 'Cuenta dada de baja. Podés recuperarla desde Papelera.' }
}
