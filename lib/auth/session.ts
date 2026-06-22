import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SessionProfile, UserRole } from '@/lib/types'

export async function getSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return {
      user,
      profile: {
        id: user.id,
        email: user.email ?? '',
        name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Usuario',
        role: (user.user_metadata?.role as UserRole) ?? 'ops',
      } satisfies SessionProfile,
    }
  }

  return {
    user,
    profile: profile as SessionProfile,
  }
}

export async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/app/login')
  return session
}
