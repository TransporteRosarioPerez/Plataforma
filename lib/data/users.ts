import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import type { UserRole } from '@/lib/types'

export type TeamProfile = {
  id: string
  email: string
  name: string
  role: UserRole
  createdAt: Date
}

type DbProfile = {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
}

function mapProfile(row: DbProfile): TeamProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: new Date(row.created_at),
  }
}

export const getTeamProfiles = cache(async (): Promise<TeamProfile[]> => {
  await requireSuperadmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, created_at')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as DbProfile[]).map(mapProfile)
})
