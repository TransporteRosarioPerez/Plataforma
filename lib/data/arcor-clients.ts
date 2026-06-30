import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapClient, type DbClient } from '@/lib/db/mappers'
import type { ArcorClient } from '@/lib/types'

const ARCOR_CLIENTS_PAGE_SIZE = 1000

async function fetchAllActiveArcorClients(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<DbClient[]> {
  const rows: DbClient[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('arcor_clients')
      .select('*')
      .is('deleted_at', null)
      .order('name')
      .range(offset, offset + ARCOR_CLIENTS_PAGE_SIZE - 1)

    if (error) throw new Error(error.message)

    const page = (data as DbClient[]) ?? []
    rows.push(...page)
    if (page.length < ARCOR_CLIENTS_PAGE_SIZE) break
    offset += ARCOR_CLIENTS_PAGE_SIZE
  }

  return rows
}

export const getArcorClients = cache(async (): Promise<ArcorClient[]> => {
  const supabase = await createClient()
  const data = await fetchAllActiveArcorClients(supabase)
  return data.map(mapClient)
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
