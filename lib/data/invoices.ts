import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapInvoice, type DbInvoice } from '@/lib/db/mappers'

export const getInvoicesByTripId = cache(async (tripId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .contains('trip_ids', [tripId])
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as DbInvoice[]).map(mapInvoice)
})
