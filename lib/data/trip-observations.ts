import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { TripObservation } from '@/lib/types'

type DbObservation = {
  id: string
  trip_id: string
  content: string
  created_at: string
  updated_at: string
}

function mapObservation(row: DbObservation): TripObservation {
  return {
    id: row.id,
    tripId: row.trip_id,
    content: row.content,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export const getTripObservations = cache(async (tripId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trip_observations')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as DbObservation[]).map(mapObservation)
})
