import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapProforma, mapProformaLineItem, type DbProforma, type DbProformaLineItem } from '@/lib/db/mappers'

async function attachLineItems(proformas: DbProforma[]) {
  if (proformas.length === 0) return []

  const supabase = await createClient()
  const ids = proformas.map((p) => p.id)
  const { data: lines, error } = await supabase
    .from('proforma_line_items')
    .select('*')
    .in('proforma_id', ids)

  if (error) throw new Error(error.message)

  const linesByProforma = new Map<string, DbProformaLineItem[]>()
  for (const line of (lines ?? []) as DbProformaLineItem[]) {
    const list = linesByProforma.get(line.proforma_id) ?? []
    list.push(line)
    linesByProforma.set(line.proforma_id, list)
  }

  return proformas.map((row) =>
    mapProforma(row, (linesByProforma.get(row.id) ?? []).map(mapProformaLineItem))
  )
}

export const getProformas = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proformas')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return attachLineItems((data ?? []) as DbProforma[])
})

export const getProformasByTripId = cache(async (tripId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proformas')
    .select('*')
    .contains('trip_ids', [tripId])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return attachLineItems((data ?? []) as DbProforma[])
})

export const getProformaById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proformas')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error) return null
  const [proforma] = await attachLineItems([data as DbProforma])
  return proforma ?? null
})
