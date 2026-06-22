import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapVehicle, type DbVehicle } from '@/lib/db/mappers'

export const getVehicles = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .is('deleted_at', null)
    .order('plate')

  if (error) throw new Error(error.message)
  return (data as DbVehicle[]).map(mapVehicle)
})

export const getVehicleById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return mapVehicle(data as DbVehicle)
})
