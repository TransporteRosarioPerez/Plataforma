'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { arcorClientSchema } from '@/lib/validations/arcor-clients'

async function accountIdTaken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  excludeId?: string
) {
  let query = supabase
    .from('arcor_clients')
    .select('id')
    .eq('account_id', accountId)
    .is('deleted_at', null)

  if (excludeId) query = query.neq('id', excludeId)

  const { data } = await query.maybeSingle()
  return !!data
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

  if (accountId) {
    const taken = await accountIdTaken(supabase, accountId, parsed.data.id)
    if (taken) return { error: 'Ya existe una cuenta con ese número de cliente' }
  }

  const row = {
    name: parsed.data.name.trim(),
    account_id: accountId,
    address: parsed.data.address?.trim() || null,
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
  return { success: parsed.data.id ? 'Cuenta actualizada' : 'Cuenta creada' }
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
