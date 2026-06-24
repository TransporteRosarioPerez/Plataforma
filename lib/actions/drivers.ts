'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { driverSchema } from '@/lib/validations/drivers'

export async function upsertDriver(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(driverSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()
  const row = {
    name: parsed.data.name,
    dni: parsed.data.dni,
    license_number: parsed.data.license_number || null,
    license_expiry: parsed.data.license_expiry || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    status: parsed.data.status,
  }

  if (parsed.data.id) {
    const { error } = await supabase.from('drivers').update(row).eq('id', parsed.data.id)
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.driverUpsert,
      entityType: 'driver',
      entityId: parsed.data.id,
      entityLabel: row.name,
      summary: `Actualizó el chofer ${row.name}`,
    })
  } else {
    const { data, error } = await supabase.from('drivers').insert(row).select('id').single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.driverUpsert,
      entityType: 'driver',
      entityId: data.id,
      entityLabel: row.name,
      summary: `Creó el chofer ${row.name}`,
    })
  }

  revalidatePath('/app/choferes')
  if (parsed.data.id) revalidatePath(`/app/choferes/${parsed.data.id}`)
  return { success: parsed.data.id ? 'Chofer actualizado' : 'Chofer creado' }
}

export async function deleteDriver(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: driver } = await supabase.from('drivers').select('name').eq('id', id).single()

  const { error } = await supabase.from('drivers').update(softDeleteUpdate()).eq('id', id).is('deleted_at', null)
  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.driverDelete,
    entityType: 'driver',
    entityId: id,
    entityLabel: driver?.name ?? undefined,
    summary: `Eliminó el chofer ${driver?.name ?? id}`,
  })

  revalidatePath('/app/choferes')
  revalidatePath('/app/viajes')
  revalidatePath('/app/papelera')
  return { success: 'Chofer dado de baja. Podés recuperarlo desde Papelera.' }
}
