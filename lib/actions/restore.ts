'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { restoreUpdate } from '@/lib/db/soft-delete'
import type { ActionState } from '@/lib/validations/parse-form'
import { getMovementQuantityDelta, wouldStockGoNegative } from '@/lib/inventory/stock'
import {
  applyProformaLineItemsToTrips,
  loadProformaLineAmounts,
} from '@/lib/proformas/trip-billing-sync'
import { recalculateTripTotals } from '@/lib/trip-totals'

export type RestorableEntity =
  | 'client'
  | 'vehicle'
  | 'driver'
  | 'trip'
  | 'proforma'
  | 'entity_document'
  | 'trip_expense'
  | 'trip_observation'
  | 'trip_document'
  | 'expense_category'
  | 'inventory_item'
  | 'inventory_movement'
  | 'invoice'

const TABLE_BY_ENTITY: Record<RestorableEntity, string> = {
  client: 'clients',
  vehicle: 'vehicles',
  driver: 'drivers',
  trip: 'trips',
  proforma: 'proformas',
  entity_document: 'entity_documents',
  trip_expense: 'trip_expenses',
  trip_observation: 'trip_observations',
  trip_document: 'trip_documents',
  expense_category: 'expense_categories',
  inventory_item: 'inventory_items',
  inventory_movement: 'inventory_movements',
  invoice: 'invoices',
}

function revalidateForEntity(entity: RestorableEntity, extra?: { tripId?: string; entityType?: string; entityId?: string; itemId?: string }) {
  revalidatePath('/app/papelera')

  switch (entity) {
    case 'client':
      revalidatePath('/app/clientes')
      revalidatePath('/app/proformas')
      break
    case 'vehicle':
      revalidatePath('/app/flota')
      if (extra?.entityId) revalidatePath(`/app/flota/${extra.entityId}`)
      break
    case 'driver':
      revalidatePath('/app/choferes')
      if (extra?.entityId) revalidatePath(`/app/choferes/${extra.entityId}`)
      break
    case 'trip':
      revalidatePath('/app/viajes')
      if (extra?.tripId) revalidatePath(`/app/viajes/${extra.tripId}`)
      break
    case 'proforma':
      revalidatePath('/app/proformas')
      revalidatePath('/app/viajes')
      break
    case 'entity_document':
      revalidatePath('/app/documentos')
      if (extra?.entityType === 'vehicle' && extra.entityId) {
        revalidatePath(`/app/flota/${extra.entityId}`)
      } else if (extra?.entityType === 'driver' && extra.entityId) {
        revalidatePath(`/app/choferes/${extra.entityId}`)
      } else if (extra?.entityType === 'company') {
        revalidatePath('/app/configuracion/empresa')
      }
      break
    case 'trip_expense':
    case 'trip_observation':
    case 'trip_document':
      if (extra?.tripId) revalidatePath(`/app/viajes/${extra.tripId}`)
      revalidatePath('/app/viajes')
      break
    case 'expense_category':
      revalidatePath('/app/configuracion/gastos')
      break
    case 'inventory_item':
    case 'inventory_movement':
      revalidatePath('/app/inventario')
      if (extra?.itemId) revalidatePath(`/app/inventario/${extra.itemId}`)
      break
    case 'invoice':
      revalidatePath('/app/facturas')
      revalidatePath('/app/proformas')
      revalidatePath('/app/viajes')
      break
  }
}

async function restoreProformaRecord(id: string): Promise<ActionState> {
  const supabase = await createClient()

  const { data: proforma, error: fetchError } = await supabase
    .from('proformas')
    .select('id, status, trip_ids, deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !proforma) return { error: 'Proforma no encontrada' }
  if (!proforma.deleted_at) return { error: 'La proforma ya está activa' }

  const tripIds: string[] = proforma.trip_ids ?? []
  if (tripIds.length > 0) {
    const { data: others } = await supabase
      .from('proformas')
      .select('id, trip_ids')
      .is('deleted_at', null)
      .in('status', ['pendiente', 'facturada'])
      .neq('id', id)

    const assigned = new Set<string>()
    for (const row of others ?? []) {
      for (const tripId of row.trip_ids ?? []) assigned.add(tripId)
    }
    const overlap = tripIds.filter((tripId) => assigned.has(tripId))
    if (overlap.length > 0) {
      return { error: 'Uno o más viajes de esta proforma ya están en otra proforma activa' }
    }
  }

  const { error } = await supabase.from('proformas').update(restoreUpdate).eq('id', id)
  if (error) return { error: error.message }

  const lineItems = await loadProformaLineAmounts(supabase, id)
  if (lineItems.length > 0) {
    const targetStatus = proforma.status === 'cobrada' ? 'paid' : 'pending_payment'
    await applyProformaLineItemsToTrips(supabase, lineItems, targetStatus)
  }

  revalidateForEntity('proforma')
  for (const tripId of tripIds) {
    revalidatePath(`/app/viajes/${tripId}`)
  }

  return { success: 'Proforma recuperada' }
}

async function restoreInventoryMovement(id: string, itemId?: string): Promise<ActionState> {
  const supabase = await createClient()

  const { data: movement, error: fetchError } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .single()

  if (fetchError || !movement) return { error: 'Movimiento no encontrado' }

  const resolvedItemId = itemId ?? movement.item_id
  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('current_quantity')
    .eq('id', resolvedItemId)
    .single()

  if (itemError || !item) return { error: 'Ítem no encontrado' }

  const delta = getMovementQuantityDelta(
    movement.movement_type,
    Number(movement.quantity),
    movement.adjustment_direction ?? undefined
  )
  const currentQuantity = Number(item.current_quantity)
  if (wouldStockGoNegative(currentQuantity, delta)) {
    return { error: 'No se puede recuperar: dejaría el stock en negativo' }
  }

  const { error } = await supabase.from('inventory_movements').update(restoreUpdate).eq('id', id)
  if (error) return { error: error.message }

  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({ current_quantity: currentQuantity + delta })
    .eq('id', resolvedItemId)

  if (updateError) return { error: updateError.message }

  revalidateForEntity('inventory_movement', { itemId: resolvedItemId })
  return { success: 'Movimiento recuperado' }
}

async function restoreTripExpense(id: string, tripId?: string): Promise<ActionState> {
  const supabase = await createClient()

  const { data: expense, error: fetchError } = await supabase
    .from('trip_expenses')
    .select('trip_id')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .single()

  if (fetchError || !expense) return { error: 'Gasto no encontrado' }

  const resolvedTripId = tripId ?? expense.trip_id
  const { error } = await supabase.from('trip_expenses').update(restoreUpdate).eq('id', id)
  if (error) return { error: error.message }

  const totals = await recalculateTripTotals(supabase, resolvedTripId)
  if ('error' in totals) return { error: totals.error }

  revalidateForEntity('trip_expense', { tripId: resolvedTripId })
  return { success: 'Gasto recuperado' }
}

async function restoreInvoiceRecord(id: string): Promise<ActionState> {
  const supabase = await createClient()

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, status, proforma_id, trip_ids')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .single()

  if (fetchError || !invoice) return { error: 'Factura no encontrada' }
  if (!invoice.proforma_id) return { error: 'Factura sin proforma vinculada' }

  const { data: other } = await supabase
    .from('invoices')
    .select('id')
    .eq('proforma_id', invoice.proforma_id)
    .is('deleted_at', null)
    .neq('id', id)
    .maybeSingle()

  if (other) {
    return { error: 'La proforma ya tiene otra factura activa' }
  }

  const { error } = await supabase.from('invoices').update(restoreUpdate).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'No se puede recuperar: conflicto con otra factura activa' }
    }
    return { error: error.message }
  }

  const proformaStatus = invoice.status === 'cobrada' ? 'cobrada' : 'facturada'
  await supabase.from('proformas').update({ status: proformaStatus }).eq('id', invoice.proforma_id)

  if (invoice.status === 'cobrada') {
    const lineItems = await loadProformaLineAmounts(supabase, invoice.proforma_id)
    await applyProformaLineItemsToTrips(supabase, lineItems, 'paid')
  }

  const tripIds: string[] = invoice.trip_ids ?? []
  revalidateForEntity('invoice')
  for (const tripId of tripIds) {
    revalidatePath(`/app/viajes/${tripId}`)
  }

  return { success: 'Factura recuperada' }
}

export async function restoreRecord(
  entity: RestorableEntity,
  id: string,
  context?: { tripId?: string; entityType?: string; entityId?: string; itemId?: string }
): Promise<ActionState> {
  await requireSuperadmin()

  if (entity === 'proforma') {
    return restoreProformaRecord(id)
  }

  if (entity === 'inventory_movement') {
    return restoreInventoryMovement(id, context?.itemId)
  }

  if (entity === 'trip_expense') {
    return restoreTripExpense(id, context?.tripId)
  }

  if (entity === 'invoice') {
    return restoreInvoiceRecord(id)
  }

  const supabase = await createClient()
  const table = TABLE_BY_ENTITY[entity]

  const { error } = await supabase.from(table).update(restoreUpdate).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'No se puede recuperar: ya existe otro registro activo con el mismo identificador' }
    }
    return { error: error.message }
  }

  revalidateForEntity(entity, context)
  return { success: 'Registro recuperado' }
}
