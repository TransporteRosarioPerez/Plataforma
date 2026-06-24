'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { inventoryItemSchema } from '@/lib/validations/inventory-items'

function revalidateInventoryPaths(itemId?: string) {
  revalidatePath('/app/inventario')
  revalidatePath('/app/dashboard')
  revalidatePath('/app/reportes')
  if (itemId) revalidatePath(`/app/inventario/${itemId}`)
}

export async function upsertInventoryItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(inventoryItemSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()

  const row = {
    name: parsed.data.name,
    sku: parsed.data.sku || null,
    category_id: parsed.data.category_id || null,
    unit: parsed.data.unit,
    min_quantity: parsed.data.min_quantity,
    notes: parsed.data.notes || null,
    is_active: parsed.data.is_active ?? true,
  }

  if (parsed.data.id) {
    const { error } = await supabase.from('inventory_items').update(row).eq('id', parsed.data.id)
    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.inventoryItemUpsert,
      entityType: 'inventory_item',
      entityId: parsed.data.id,
      entityLabel: row.name,
      summary: `Actualizó el ítem ${row.name}`,
    })
    revalidateInventoryPaths(parsed.data.id)
    return { success: 'Ítem actualizado' }
  }

  const { data, error } = await supabase.from('inventory_items').insert(row).select('id').single()
  if (error || !data) return { error: error?.message ?? 'Error al crear ítem' }

  await logAudit({
    action: AUDIT_ACTIONS.inventoryItemUpsert,
    entityType: 'inventory_item',
    entityId: data.id,
    entityLabel: row.name,
    summary: `Creó el ítem ${row.name}`,
  })

  revalidateInventoryPaths(data.id)
  return { success: 'Ítem creado' }
}

export async function deleteInventoryItem(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: item } = await supabase.from('inventory_items').select('name').eq('id', id).single()

  const { error } = await supabase
    .from('inventory_items')
    .update(softDeleteUpdate())
    .eq('id', id)
    .is('deleted_at', null)
  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.inventoryItemDelete,
    entityType: 'inventory_item',
    entityId: id,
    entityLabel: item?.name ?? undefined,
    summary: `Eliminó el ítem ${item?.name ?? id}`,
  })

  revalidateInventoryPaths()
  revalidatePath('/app/papelera')
  return { success: 'Ítem dado de baja. Podés recuperarlo desde Papelera.' }
}

export async function setInventoryItemActive(
  id: string,
  isActive: boolean
): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()
  const { error } = await supabase
    .from('inventory_items')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { error: error.message }

  const { data: item } = await supabase.from('inventory_items').select('name').eq('id', id).single()

  await logAudit({
    action: AUDIT_ACTIONS.inventoryItemSetActive,
    entityType: 'inventory_item',
    entityId: id,
    entityLabel: item?.name ?? undefined,
    summary: isActive ? `Reactivó el ítem ${item?.name ?? id}` : `Desactivó el ítem ${item?.name ?? id}`,
    metadata: { isActive },
  })

  revalidateInventoryPaths(id)
  return { success: isActive ? 'Ítem reactivado' : 'Ítem desactivado' }
}
