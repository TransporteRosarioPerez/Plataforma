import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { InventoryItem } from '@/lib/types'

type DbInventoryCategory = {
  id: string
  code: string
  name: string
  is_active: boolean
}

type DbInventoryItem = {
  id: string
  name: string
  sku: string | null
  category_id: string | null
  unit: string
  min_quantity: number
  current_quantity: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  inventory_categories?: DbInventoryCategory | null
}

function mapItem(row: DbInventoryItem): InventoryItem {
  return {
    id: row.id,
    organizationId: '',
    name: row.name,
    sku: row.sku ?? undefined,
    categoryId: row.category_id ?? undefined,
    category: row.inventory_categories
      ? {
          id: row.inventory_categories.id,
          organizationId: '',
          code: row.inventory_categories.code,
          name: row.inventory_categories.name,
          isActive: row.inventory_categories.is_active,
          createdAt: new Date(),
        }
      : undefined,
    unit: row.unit,
    minQuantity: Number(row.min_quantity),
    currentQuantity: Number(row.current_quantity),
    notes: row.notes ?? undefined,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

const itemSelect = `
  *,
  inventory_categories (*)
`

export const getInventoryItems = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select(itemSelect)
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(error.message)
  return (data as DbInventoryItem[]).map(mapItem)
})

export const getInventoryItemById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select(itemSelect)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return mapItem(data as DbInventoryItem)
})

export const getLowStockInventoryItems = cache(async () => {
  const items = await getInventoryItems()
  return items.filter(
    (item) => item.isActive && item.currentQuantity <= item.minQuantity
  )
})
