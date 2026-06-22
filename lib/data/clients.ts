import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapClient, type DbClient } from '@/lib/db/mappers'

export const getClients = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(error.message)
  return (data as DbClient[]).map(mapClient)
})

export const getClientById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return mapClient(data as DbClient)
})
