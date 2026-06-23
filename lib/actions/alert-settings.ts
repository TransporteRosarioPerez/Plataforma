'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { alertSettingsSchema } from '@/lib/validations/entity-documents'

export async function updateAlertSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin()
  const parsed = parseForm(alertSettingsSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const phones = (parsed.data.alert_whatsapp_phones ?? '')
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const supabase = await createClient()
  const { error } = await supabase
    .from('company_settings')
    .update({
      alert_enabled: parsed.data.alert_enabled === 'true',
      alert_whatsapp_phones: phones,
      alert_days_before: parsed.data.alert_days_before ?? 7,
    })
    .eq('id', parsed.data.id)

  if (error) return { error: error.message }

  revalidatePath('/app/configuracion/notificaciones')
  return { success: 'Configuración de alertas guardada' }
}
