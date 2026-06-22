import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapDriver, type DbDriver } from '@/lib/db/mappers'

export const getDrivers = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(error.message)
  return (data as DbDriver[]).map(mapDriver)
})

export const getDriverById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return mapDriver(data as DbDriver)
})
