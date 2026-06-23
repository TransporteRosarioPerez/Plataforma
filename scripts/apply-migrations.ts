#!/usr/bin/env npx tsx
/**
 * Aplica migraciones SQL en orden contra Supabase Postgres.
 *
 * Uso:
 *   SUPABASE_DATABASE_URL="postgresql://postgres.[ref]:[pass]@...supabase.com:5432/postgres" pnpm apply:migrations
 *
 * Password: Supabase → Project Settings → Database → Connection string (URI)
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import pg from 'pg'
import { loadEnvLocal } from './load-env-local'

const { Client } = pg

const ORDER = [
  '001_initial_schema.sql',
  '002_seed_config.sql',
  '004_legacy_fields.sql',
  '005_mvp_alerts.sql',
  '006_entity_documents_freeform.sql',
  '007_document_renewal_and_history.sql',
  '008_billing_clients_and_proforma_lines.sql',
  '009_inventory.sql',
  '010_soft_delete.sql',
  '011_trip_observations_soft_delete.sql',
  '012_trip_unit_price.sql',
]

async function main() {
  loadEnvLocal()
  const url = process.env.SUPABASE_DATABASE_URL
  if (!url) {
    throw new Error(
      'Falta SUPABASE_DATABASE_URL en .env.local (Supabase → Settings → Database → URI)'
    )
  }

  const dir = resolve(process.cwd(), 'supabase/migrations')
  const files = readdirSync(dir)
  for (const name of ORDER) {
    if (!files.includes(name)) throw new Error(`No se encontró migración ${name}`)
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Conectado a Supabase Postgres\n')

  try {
    for (const name of ORDER) {
      const sql = readFileSync(resolve(dir, name), 'utf8')
      console.log(`→ ${name} ...`)
      await client.query(sql)
      console.log(`  OK`)
    }
    console.log('\nTodas las migraciones aplicadas.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
