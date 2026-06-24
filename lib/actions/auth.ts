'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import type { ActionState } from '@/lib/validations/parse-form'

export async function signIn(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = formData.get('email')?.toString().trim()
  const password = formData.get('password')?.toString()

  if (!email || !password) {
    return { error: 'Email y contraseña son requeridos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Credenciales inválidas' }
  }

  await logAudit({
    action: AUDIT_ACTIONS.authSignIn,
    entityType: 'session',
    summary: `Inicio de sesión (${email})`,
  })

  revalidatePath('/', 'layout')
  redirect('/app/dashboard')
}

export async function signOut() {
  await logAudit({
    action: AUDIT_ACTIONS.authSignOut,
    entityType: 'session',
    summary: 'Cierre de sesión',
  })

  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/app/login')
}
