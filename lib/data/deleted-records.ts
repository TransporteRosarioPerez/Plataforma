import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { RestorableEntity } from '@/lib/actions/restore'
import type { DeletedRecordRow } from '@/lib/deleted-records/types'

export type { DeletedRecordRow } from '@/lib/deleted-records/types'

export const getDeletedRecords = cache(async (): Promise<DeletedRecordRow[]> => {
  const supabase = await createClient()

  const [
    clientsRes,
    vehiclesRes,
    driversRes,
    tripsRes,
    proformasRes,
    documentsRes,
    tripExpensesRes,
    tripObservationsRes,
    tripDocumentsRes,
    categoriesRes,
    itemsRes,
    movementsRes,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('vehicles')
      .select('id, plate, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('drivers')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('trips')
      .select('id, code, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('proformas')
      .select('id, proforma_number, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('entity_documents')
      .select('id, name, entity_type, entity_id, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('trip_expenses')
      .select('id, description, category_name, trip_id, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('trip_observations')
      .select('id, content, trip_id, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('trip_documents')
      .select('id, document_type, trip_id, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('expense_categories')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('inventory_items')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('inventory_movements')
      .select('id, movement_type, item_id, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
  ])

  const rows: DeletedRecordRow[] = []

  for (const row of clientsRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'client',
      label: row.name,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of vehiclesRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'vehicle',
      label: row.plate,
      deletedAt: new Date(row.deleted_at as string),
      context: { entityId: row.id },
    })
  }

  for (const row of driversRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'driver',
      label: row.name,
      deletedAt: new Date(row.deleted_at as string),
      context: { entityId: row.id },
    })
  }

  for (const row of tripsRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'trip',
      label: row.code,
      deletedAt: new Date(row.deleted_at as string),
      context: { tripId: row.id },
    })
  }

  for (const row of proformasRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'proforma',
      label: row.proforma_number,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of documentsRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'entity_document',
      label: row.name,
      deletedAt: new Date(row.deleted_at as string),
      context: { entityType: row.entity_type, entityId: row.entity_id },
    })
  }

  for (const row of tripExpensesRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'trip_expense',
      label: row.description || row.category_name || 'Gasto',
      deletedAt: new Date(row.deleted_at as string),
      context: { tripId: row.trip_id },
    })
  }

  for (const row of tripObservationsRes.data ?? []) {
    const preview = row.content.length > 60 ? `${row.content.slice(0, 60)}…` : row.content
    rows.push({
      id: row.id,
      entity: 'trip_observation',
      label: preview || 'Observación',
      deletedAt: new Date(row.deleted_at as string),
      context: { tripId: row.trip_id },
    })
  }

  for (const row of tripDocumentsRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'trip_document',
      label: row.document_type,
      deletedAt: new Date(row.deleted_at as string),
      context: { tripId: row.trip_id },
    })
  }

  for (const row of categoriesRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'expense_category',
      label: row.name,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of itemsRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'inventory_item',
      label: row.name,
      deletedAt: new Date(row.deleted_at as string),
      context: { itemId: row.id },
    })
  }

  for (const row of movementsRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'inventory_movement',
      label: row.movement_type,
      deletedAt: new Date(row.deleted_at as string),
      context: { itemId: row.item_id },
    })
  }

  return rows.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
})
