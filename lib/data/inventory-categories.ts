import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { InventoryCategory } from '@/lib/types'

type DbInventoryCategory = {
  id: string
  code: string
  name: string
  is_active: boolean
  created_at: string
}

function mapCategory(row: DbInventoryCategory): InventoryCategory {
  return {
    id: row.id,
    organizationId: '',
    code: row.code,
    name: row.name,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
  }
}

export const getInventoryCategories = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_categories')
    .select('*')
    .order('name')

  if (error) throw new Error(error.message)
  return (data as DbInventoryCategory[]).map(mapCategory)
})

export const getActiveInventoryCategories = cache(async () => {
  const categories = await getInventoryCategories()
  return categories.filter((c) => c.isActive)
})
