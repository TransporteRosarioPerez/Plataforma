'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import type { ActionState } from '@/lib/validations/parse-form'
import type { UserRole } from '@/lib/types'

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['superadmin', 'ops']),
})

export async function updateUserRole(userId: string, role: UserRole): Promise<ActionState> {
  const { profile } = await requireSuperadmin()
  const parsed = updateRoleSchema.safeParse({ userId, role })
  if (!parsed.success) return { error: 'Datos inválidos' }

  if (parsed.data.userId === profile.id && parsed.data.role !== 'superadmin') {
    return { error: 'No podés cambiar tu propio rol de superadmin' }
  }

  const supabase = await createClient()

  if (parsed.data.role !== 'superadmin') {
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', parsed.data.userId)
      .single()

    if (target?.role === 'superadmin') {
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'superadmin')

      if (countError) return { error: countError.message }
      if ((count ?? 0) <= 1) {
        return { error: 'Debe quedar al menos un superadmin en la plataforma' }
      }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userId)

  if (error) return { error: error.message }

  revalidatePath('/app/equipo')
  return { success: 'Rol actualizado' }
}
