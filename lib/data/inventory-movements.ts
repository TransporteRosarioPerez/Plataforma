import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { InventoryMovement, InventoryMovementType, InventoryAdjustmentDirection } from '@/lib/types'

type DbInventoryMovement = {
  id: string
  item_id: string
  movement_type: InventoryMovementType
  quantity: number
  adjustment_direction: InventoryAdjustmentDirection | null
  unit_cost: number | null
  total_cost: number | null
  supplier_name: string | null
  invoice_reference: string | null
  movement_date: string
  notes: string | null
  created_at: string
}

function mapMovement(row: DbInventoryMovement): InventoryMovement {
  return {
    id: row.id,
    itemId: row.item_id,
    movementType: row.movement_type,
    quantity: Number(row.quantity),
    adjustmentDirection: row.adjustment_direction ?? undefined,
    unitCost: row.unit_cost != null ? Number(row.unit_cost) : undefined,
    totalCost: row.total_cost != null ? Number(row.total_cost) : undefined,
    supplierName: row.supplier_name ?? undefined,
    invoiceReference: row.invoice_reference ?? undefined,
    movementDate: new Date(row.movement_date),
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

export const getInventoryMovementsByItemId = cache(async (itemId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('item_id', itemId)
    .is('deleted_at', null)
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as DbInventoryMovement[]).map(mapMovement)
})

export const getInventoryPurchasesInRange = cache(async (from: Date, to: Date) => {
  const supabase = await createClient()
  const fromIso = from.toISOString().slice(0, 10)
  const toIso = to.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('inventory_movements')
    .select('total_cost, movement_date')
    .eq('movement_type', 'purchase')
    .is('deleted_at', null)
    .gte('movement_date', fromIso)
    .lte('movement_date', toIso)

  if (error) throw new Error(error.message)
  return (data ?? []) as { total_cost: number; movement_date: string }[]
})

export const getInventoryPurchaseTotalInRange = cache(async (from: Date, to: Date) => {
  const purchases = await getInventoryPurchasesInRange(from, to)
  return purchases.reduce((sum, row) => sum + Number(row.total_cost ?? 0), 0)
})
