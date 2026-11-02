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
    arcorClientsRes,
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
    invoicesRes,
    treasuryTxRes,
    treasuryBatchesRes,
    treasuryRulesRes,
    treasuryCategoriesRes,
    treasuryCounterpartiesRes,
    treasuryChequesRes,
    treasuryReceivedRes,
    treasuryCashCountsRes,
    treasuryForecastRes,
    crmQuotesRes,
    crmCompaniesRes,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('arcor_clients')
      .select('id, name, account_id, deleted_at')
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
    supabase
      .from('invoices')
      .select('id, invoice_number, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    // Tesorería (las tablas devuelven vacío por RLS si el usuario no es superadmin)
    supabase
      .from('treasury_transactions')
      .select('id, tx_date, description_raw, amount, import_batch_id, source, deleted_at')
      .not('deleted_at', 'is', null)
      .neq('source', 'transfer_mirror')
      .order('deleted_at', { ascending: false })
      .limit(500),
    supabase
      .from('treasury_import_batches')
      .select('id, file_name, row_count, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('treasury_rules')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('treasury_categories')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('treasury_counterparties')
      .select('id, name, cuit, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('treasury_cheques')
      .select('id, cheque_number, payee_name, amount, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('treasury_received_cheques')
      .select('id, cheque_number, issuer_name, amount, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('treasury_cash_counts')
      .select('id, count_date, counted_amount, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('treasury_forecast_items')
      .select('id, name, amount, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    // CRM (vacío por RLS si no es superadmin)
    supabase
      .from('crm_quotes')
      .select('id, number, deleted_at, company:crm_companies!crm_quotes_company_id_fkey(name)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(500),
    // Las empresas fusionadas no se recuperan (sus datos ya pasaron a la otra)
    supabase
      .from('crm_companies')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .is('merged_into_id', null)
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

  for (const row of arcorClientsRes.data ?? []) {
    const label = row.account_id ? `${row.account_id} — ${row.name}` : row.name
    rows.push({
      id: row.id,
      entity: 'arcor_client',
      label,
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

  for (const row of invoicesRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'invoice',
      label: row.invoice_number,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  const deletedBatchIds = new Set((treasuryBatchesRes.data ?? []).map((b) => b.id as string))
  const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

  for (const row of treasuryBatchesRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'treasury_import_batch',
      label: `${row.file_name} (${row.row_count} movimientos)`,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of treasuryTxRes.data ?? []) {
    // Los movimientos de una importación borrada se recuperan junto con la importación.
    if (row.import_batch_id && deletedBatchIds.has(row.import_batch_id as string)) continue
    const [y, m, d] = String(row.tx_date).split('-')
    rows.push({
      id: row.id,
      entity: 'treasury_transaction',
      label: `${d}/${m}/${y} · ${row.description_raw} · ${money.format(Number(row.amount))}`,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of treasuryRulesRes.data ?? []) {
    rows.push({ id: row.id, entity: 'treasury_rule', label: row.name, deletedAt: new Date(row.deleted_at as string) })
  }

  for (const row of treasuryCategoriesRes.data ?? []) {
    rows.push({ id: row.id, entity: 'treasury_category', label: row.name, deletedAt: new Date(row.deleted_at as string) })
  }

  for (const row of treasuryCounterpartiesRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'treasury_counterparty',
      label: `${row.name} (${row.cuit})`,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of treasuryChequesRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'treasury_cheque',
      label: `N° ${row.cheque_number} · ${row.payee_name} · ${money.format(Number(row.amount))}`,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of treasuryReceivedRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'treasury_received_cheque',
      label: `N° ${row.cheque_number} · ${row.issuer_name} · ${money.format(Number(row.amount))}`,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of treasuryCashCountsRes.data ?? []) {
    const [y, m, d] = String(row.count_date).split('-')
    rows.push({
      id: row.id,
      entity: 'treasury_cash_count',
      label: `Arqueo ${d}/${m}/${y} · ${money.format(Number(row.counted_amount))}`,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of treasuryForecastRes.data ?? []) {
    rows.push({
      id: row.id,
      entity: 'treasury_forecast_item',
      label: `${row.name} · ${money.format(Number(row.amount))}`,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of crmQuotesRes.data ?? []) {
    const company = Array.isArray(row.company) ? row.company[0]?.name : (row.company as { name?: string } | null)?.name
    rows.push({
      id: row.id,
      entity: 'crm_quote',
      label: `COT-${String(row.number).padStart(4, '0')} · ${company ?? '—'}`,
      deletedAt: new Date(row.deleted_at as string),
    })
  }

  for (const row of crmCompaniesRes.data ?? []) {
    rows.push({ id: row.id, entity: 'crm_company', label: row.name, deletedAt: new Date(row.deleted_at as string) })
  }

  return rows.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
})
