'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { clientSchema } from '@/lib/validations/clients'

export async function upsertClient(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(clientSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()

  const row = {
    name: parsed.data.name,
    cuit: parsed.data.cuit || null,
    address: parsed.data.address || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    contact_name: parsed.data.contact_name || null,
    notes: parsed.data.notes || null,
  }

  if (parsed.data.id) {
    const { error } = await supabase.from('clients').update(row).eq('id', parsed.data.id)
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.clientUpsert,
      entityType: 'client',
      entityId: parsed.data.id,
      entityLabel: row.name,
      summary: `Actualizó el cliente ${row.name}`,
    })
  } else {
    const { data, error } = await supabase.from('clients').insert(row).select('id').single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.clientUpsert,
      entityType: 'client',
      entityId: data.id,
      entityLabel: row.name,
      summary: `Creó el cliente ${row.name}`,
    })
  }

  revalidatePath('/app/clientes')
  revalidatePath('/app/proformas')
  return { success: parsed.data.id ? 'Cliente actualizado' : 'Cliente creado' }
}

export async function deleteClient(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: client } = await supabase.from('clients').select('name').eq('id', id).single()

  const { error } = await supabase.from('clients').update(softDeleteUpdate()).eq('id', id).is('deleted_at', null)
  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.clientDelete,
    entityType: 'client',
    entityId: id,
    entityLabel: client?.name ?? undefined,
    summary: `Eliminó el cliente ${client?.name ?? id}`,
  })

  revalidatePath('/app/clientes')
  revalidatePath('/app/proformas')
  revalidatePath('/app/papelera')
  return { success: 'Cliente dado de baja. Podés recuperarlo desde Papelera.' }
}
