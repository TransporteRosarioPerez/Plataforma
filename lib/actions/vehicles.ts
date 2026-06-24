'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { vehicleSchema } from '@/lib/validations/vehicles'

export async function upsertVehicle(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(vehicleSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()
  const row = {
    plate: parsed.data.plate.toUpperCase().replace(/\s/g, ''),
    brand: parsed.data.brand,
    model: parsed.data.model,
    year: parsed.data.year,
    type: parsed.data.type,
    status: parsed.data.status,
  }

  if (parsed.data.id) {
    const { error } = await supabase.from('vehicles').update(row).eq('id', parsed.data.id)
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.vehicleUpsert,
      entityType: 'vehicle',
      entityId: parsed.data.id,
      entityLabel: row.plate,
      summary: `Actualizó el vehículo ${row.plate}`,
    })
  } else {
    const { data, error } = await supabase.from('vehicles').insert(row).select('id').single()
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.vehicleUpsert,
      entityType: 'vehicle',
      entityId: data.id,
      entityLabel: row.plate,
      summary: `Creó el vehículo ${row.plate}`,
    })
  }

  revalidatePath('/app/flota')
  if (parsed.data.id) revalidatePath(`/app/flota/${parsed.data.id}`)
  return { success: parsed.data.id ? 'Vehículo actualizado' : 'Vehículo creado' }
}

export async function deleteVehicle(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: vehicle } = await supabase.from('vehicles').select('plate').eq('id', id).single()

  const { error } = await supabase.from('vehicles').update(softDeleteUpdate()).eq('id', id).is('deleted_at', null)
  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.vehicleDelete,
    entityType: 'vehicle',
    entityId: id,
    entityLabel: vehicle?.plate ?? undefined,
    summary: `Eliminó el vehículo ${vehicle?.plate ?? id}`,
  })

  revalidatePath('/app/flota')
  revalidatePath('/app/viajes')
  revalidatePath('/app/papelera')
  return { success: 'Vehículo dado de baja. Podés recuperarlo desde Papelera.' }
}
