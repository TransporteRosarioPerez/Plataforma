'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
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
  } else {
    const { error } = await supabase.from('drivers').insert(row)
    if (error) return { error: error.message }
  }

  revalidatePath('/app/choferes')
  if (parsed.data.id) revalidatePath(`/app/choferes/${parsed.data.id}`)
  return { success: parsed.data.id ? 'Chofer actualizado' : 'Chofer creado' }
}

export async function deleteDriver(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()
  const { error } = await supabase.from('drivers').update(softDeleteUpdate()).eq('id', id).is('deleted_at', null)
  if (error) return { error: error.message }
  revalidatePath('/app/choferes')
  revalidatePath('/app/viajes')
  revalidatePath('/app/papelera')
  return { success: 'Chofer dado de baja. Podés recuperarlo desde Papelera.' }
}
