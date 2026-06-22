'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'

const companySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'El nombre es requerido'),
  cuit: z.string().optional(),
  address: z.string().optional(),
})

export async function updateCompanySettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(companySchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('company_settings')
    .update({
      name: parsed.data.name,
      cuit: parsed.data.cuit || null,
      address: parsed.data.address || null,
    })
    .eq('id', parsed.data.id)

  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  revalidatePath('/app/configuracion/empresa')
  return { success: 'Datos de empresa actualizados' }
}
