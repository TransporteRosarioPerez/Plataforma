#!/usr/bin/env npx tsx
/**
 * Vacía datos operativos en Supabase para volver a correr migrate:legacy.
 *
 * Uso:
 *   pnpm reset:legacy-data -- --dry-run
 *   pnpm reset:legacy-data -- --confirm=CUTOVER
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY (+ URL) o SUPABASE_DATABASE_URL para TRUNCATE directo.
 * NO borra usuarios (auth/profiles), company_settings ni categorías de gasto.
 */

import pg from 'pg'
import { loadEnvLocal } from './load-env-local'
import { createServiceRoleClient } from '../lib/supabase/service-role'

const { Pool } = pg

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const confirmArg = args.find((a) => a.startsWith('--confirm='))
const confirmed = confirmArg?.replace('--confirm=', '') === 'CUTOVER'

const TABLES_IN_DELETE_ORDER = [
  'notification_log',
  'proforma_line_items',
  'invoices',
  'proformas',
  'fuel_transactions',
  'fuel_import_batches',
  'inventory_movements',
  'inventory_items',
  'inventory_categories',
  'trip_observations',
  'trip_expenses',
  'trip_documents',
  'trips',
  'entity_documents',
  'legacy_id_map',
  'arcor_clients',
  'clients',
  'vehicles',
  'drivers',
] as const

async function countTable(
  supabase: ReturnType<typeof createServiceRoleClient>,
  table: string
) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (error) {
    if (error.message.includes('does not exist')) return null
    throw new Error(`${table}: ${error.message}`)
  }
  return count ?? 0
}

async function dryRunCounts() {
  const supabase = createServiceRoleClient()
  console.log('\nConteo actual en Supabase (se borrarían):\n')

  let total = 0
  for (const table of TABLES_IN_DELETE_ORDER) {
    const count = await countTable(supabase, table)
    if (count === null) {
      console.log(`  ${table.padEnd(24)} — (tabla no existe, se omite)`)
      continue
    }
    console.log(`  ${table.padEnd(24)} ${count}`)
    total += count
  }

  console.log(`\n  Total filas aprox.: ${total}`)
  console.log('\nSe conservan: profiles, company_settings, expense_categories, document_types, auth.users')
}

async function resetViaPostgres() {
  const url = process.env.SUPABASE_DATABASE_URL
  if (!url) return false

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  try {
    const tables = TABLES_IN_DELETE_ORDER.join(',\n  public.')
    await pool.query(`
      truncate table
        public.${tables}
      restart identity cascade
    `)
    return true
  } finally {
    await pool.end()
  }
}

async function deleteAllFromTable(
  supabase: ReturnType<typeof createServiceRoleClient>,
  table: string
) {
  const filters =
    table === 'legacy_id_map'
      ? ['legacy_id', 'entity_type', 'created_at']
      : ['id', 'created_at']

  for (const column of filters) {
    const { error } = await supabase.from(table).delete().not(column, 'is', null)
    if (!error) return
    if (!error.message.toLowerCase().includes('column')) {
      throw new Error(`${table}: ${error.message}`)
    }
  }

  throw new Error(`${table}: no se encontró columna para borrar filas`)
}

async function resetViaServiceRole() {
  const supabase = createServiceRoleClient()
  for (const table of TABLES_IN_DELETE_ORDER) {
    process.stdout.write(`  Borrando ${table}... `)
    try {
      await deleteAllFromTable(supabase, table)
      console.log('ok')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('does not exist')) {
        console.log('omitido (no existe)')
        continue
      }
      throw err
    }
  }
}

async function main() {
  loadEnvLocal()

  if (dryRun) {
    await dryRunCounts()
    console.log('\nDry-run: no se modificó nada.')
    return
  }

  if (!confirmed) {
    console.error(
      '⚠️  Esto BORRA viajes, clientes, flota, proformas, combustible, inventario y legacy_id_map.\n' +
        '    Para ejecutar: pnpm reset:legacy-data -- --confirm=CUTOVER\n' +
        '    Para ver conteos: pnpm reset:legacy-data -- --dry-run'
    )
    process.exit(1)
  }

  console.log('Reseteando datos operativos en Supabase...\n')

  const usedPostgres = await resetViaPostgres().catch(() => false)
  if (usedPostgres) {
    console.log('Listo (TRUNCATE vía SUPABASE_DATABASE_URL).')
  } else {
    console.log('SUPABASE_DATABASE_URL no disponible — borrando vía API...\n')
    await resetViaServiceRole()
    console.log('\nListo (delete vía service role).')
  }

  console.log('\nSiguiente paso:')
  console.log('  pnpm migrate:legacy -- --dry-run')
  console.log('  pnpm migrate:legacy')
  console.log('  pnpm cutover:legacy   # reset + migrate en un solo comando')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
