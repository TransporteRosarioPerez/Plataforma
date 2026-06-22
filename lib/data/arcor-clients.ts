import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapClient, type DbClient } from '@/lib/db/mappers'
import type { ArcorClient } from '@/lib/types'

export const getArcorClients = cache(async (): Promise<ArcorClient[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('arcor_clients')
    .select('*')
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(error.message)
  return (data as DbClient[]).map(mapClient)
})

export const getArcorClientById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('arcor_clients')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return mapClient(data as DbClient)
})
