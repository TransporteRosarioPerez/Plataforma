'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { inventoryMovementSchema } from '@/lib/validations/inventory-movements'
import { getMovementQuantityDelta, wouldStockGoNegative } from '@/lib/inventory/stock'

function revalidateInventoryPaths(itemId: string) {
  revalidatePath('/app/inventario')
  revalidatePath(`/app/inventario/${itemId}`)
  revalidatePath('/app/dashboard')
  revalidatePath('/app/reportes')
}

export async function createInventoryMovement(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()

  const movementType = formData.get('movement_type')
  const raw = {
    item_id: formData.get('item_id'),
    movement_type: movementType,
    quantity: formData.get('quantity'),
    movement_date: formData.get('movement_date'),
    notes: formData.get('notes') || undefined,
    unit_cost: formData.get('unit_cost') || undefined,
    supplier_name: formData.get('supplier_name') || undefined,
    invoice_reference: formData.get('invoice_reference') || undefined,
    adjustment_direction: formData.get('adjustment_direction') || undefined,
  }

  const parsed = inventoryMovementSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? 'Datos inválidos' }
  }

  const data = parsed.data
  const supabase = await createClient()

  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('id, current_quantity, is_active')
    .eq('id', data.item_id)
    .is('deleted_at', null)
    .single()

  if (itemError || !item) return { error: 'Ítem no encontrado' }
  if (!item.is_active) return { error: 'El ítem está desactivado' }

  const delta = getMovementQuantityDelta(
    data.movement_type,
    data.quantity,
    data.movement_type === 'adjustment' ? data.adjustment_direction : undefined
  )

  const currentQuantity = Number(item.current_quantity)
  if (wouldStockGoNegative(currentQuantity, delta)) {
    return { error: 'Stock insuficiente para este movimiento' }
  }

  const row: Record<string, unknown> = {
    item_id: data.item_id,
    movement_type: data.movement_type,
    quantity: data.quantity,
    movement_date: data.movement_date,
    notes: data.notes || null,
    adjustment_direction: null,
    unit_cost: null,
    total_cost: null,
    supplier_name: null,
    invoice_reference: null,
  }

  if (data.movement_type === 'purchase') {
    row.unit_cost = data.unit_cost
    row.total_cost = data.quantity * data.unit_cost
    row.supplier_name = data.supplier_name || null
    row.invoice_reference = data.invoice_reference || null
  } else if (data.movement_type === 'adjustment') {
    row.adjustment_direction = data.adjustment_direction
  }

  const { error: insertError } = await supabase.from('inventory_movements').insert(row)
  if (insertError) return { error: insertError.message }

  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({ current_quantity: currentQuantity + delta })
    .eq('id', data.item_id)

  if (updateError) return { error: updateError.message }

  revalidateInventoryPaths(data.item_id)

  const labels = {
    purchase: 'Compra registrada',
    consumption: 'Consumo registrado',
    adjustment: 'Ajuste registrado',
  }

  return { success: labels[data.movement_type] }
}

export async function deleteInventoryMovement(id: string, itemId: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: movement, error: fetchError } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !movement) return { error: 'Movimiento no encontrado' }

  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('current_quantity')
    .eq('id', itemId)
    .single()

  if (itemError || !item) return { error: 'Ítem no encontrado' }

  const reverseDelta = -getMovementQuantityDelta(
    movement.movement_type,
    Number(movement.quantity),
    movement.adjustment_direction ?? undefined
  )

  const currentQuantity = Number(item.current_quantity)
  if (wouldStockGoNegative(currentQuantity, reverseDelta)) {
    return { error: 'No se puede eliminar: dejaría el stock en negativo' }
  }

  const { error: deleteError } = await supabase
    .from('inventory_movements')
    .update(softDeleteUpdate())
    .eq('id', id)
    .is('deleted_at', null)
  if (deleteError) return { error: deleteError.message }

  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({ current_quantity: currentQuantity + reverseDelta })
    .eq('id', itemId)

  if (updateError) return { error: updateError.message }

  revalidateInventoryPaths(itemId)
  revalidatePath('/app/papelera')
  return { success: 'Movimiento dado de baja. Podés recuperarlo desde Papelera.' }
}
