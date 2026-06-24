'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
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
  await requireSuperadmin()
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

  await logAudit({
    action: AUDIT_ACTIONS.companySettingsUpdate,
    entityType: 'company_settings',
    entityId: parsed.data.id,
    entityLabel: parsed.data.name,
    summary: `Actualizó datos de la empresa (${parsed.data.name})`,
  })

  revalidatePath('/app', 'layout')
  revalidatePath('/app/configuracion/empresa')
  return { success: 'Datos de empresa actualizados' }
}
