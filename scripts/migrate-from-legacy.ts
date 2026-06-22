#!/usr/bin/env npx tsx
/**
 * Migración idempotente Neon (Prisma legado) → Supabase RemitoListo.
 *
 * Uso:
 *   LEGACY_DATABASE_URL=postgresql://... SUPABASE_SERVICE_ROLE_KEY=... pnpm migrate:legacy
 *   pnpm migrate:legacy -- --dry-run
 *   pnpm migrate:legacy -- --only=clients,trips
 *
 * Requisito: ejecutar antes TODAS las migraciones SQL (001→012) en Supabase vacío.
 * Los clientes del legado van a arcor_clients; clients queda para facturación manual.
 */

import pg from 'pg'
import { loadEnvLocal } from './load-env-local'
import { createServiceRoleClient } from '../lib/supabase/service-role'
import {
  mapLegacyArcorClientToInsert,
  mapLegacyDriverUserToInsert,
  mapLegacyPdfDocument,
  mapLegacyTravelToTripInsert,
  mapLegacyVehicleToInsert,
  legacyPdfStorageKey,
} from '../lib/integrations/legacy-mvp/mappers'

const { Pool } = pg

type EntityType = 'client' | 'vehicle_truck' | 'vehicle_semi' | 'driver' | 'trip' | 'observation'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const onlyArg = args.find((a) => a.startsWith('--only='))
const only = onlyArg ? onlyArg.replace('--only=', '').split(',') : null

function shouldRun(section: string) {
  if (!only) return true
  return only.includes(section)
}

const stats = {
  inserted: 0,
  skipped: 0,
  errors: 0,
  warnings: [] as string[],
}

async function getLegacyPool() {
  const url = process.env.LEGACY_DATABASE_URL
  if (!url) throw new Error('LEGACY_DATABASE_URL es requerido')
  return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function findByLegacyId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  entityType: EntityType,
  legacyId: string
) {
  const table =
    entityType === 'client'
      ? 'arcor_clients'
      : entityType === 'driver'
        ? 'drivers'
        : entityType.startsWith('vehicle')
          ? 'vehicles'
          : entityType === 'trip'
            ? 'trips'
            : 'trip_observations'

  const { data } = await supabase.from(table).select('id').eq('legacy_id', legacyId).maybeSingle()
  return data?.id as string | undefined
}

async function saveMap(
  supabase: ReturnType<typeof createServiceRoleClient>,
  entityType: EntityType,
  legacyId: string,
  supabaseId: string
) {
  if (dryRun) return
  await supabase.from('legacy_id_map').upsert({
    entity_type: entityType,
    legacy_id: legacyId,
    supabase_id: supabaseId,
  })
}

async function resolveProfileByLegacyUserId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  pool: pg.Pool,
  legacyUserId: string | null
): Promise<string | null> {
  if (!legacyUserId) return null
  const res = await pool.query<{ email: string | null }>(
    `SELECT email FROM "User" WHERE id = $1 LIMIT 1`,
    [legacyUserId]
  )
  const email = res.rows[0]?.email
  if (!email) return null
  const { data } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!data) {
    stats.warnings.push(`Usuario legado ${legacyUserId} (${email}) sin profile en Supabase`)
    return null
  }
  return data.id
}

async function migrateClients(pool: pg.Pool, supabase: ReturnType<typeof createServiceRoleClient>) {
  if (!shouldRun('clients')) return

  const res = await pool.query<{
    id: string
    name: string
    accountId: string
    location: string
    analystId: string
  }>(`
    SELECT c.id, c.name, c."accountId", c.location, c."analystId"
    FROM "Client" c
  `)

  for (const row of res.rows) {
    const existing = await findByLegacyId(supabase, 'client', row.id)
    if (existing) {
      stats.skipped++
      continue
    }

    const rowData = mapLegacyArcorClientToInsert(row)

    if (dryRun) {
      stats.inserted++
      continue
    }

    const { data, error } = await supabase.from('arcor_clients').insert(rowData).select('id').single()
    if (error) {
      stats.errors++
      console.error('Client error', row.id, error.message)
      continue
    }
    await saveMap(supabase, 'client', row.id, data.id)
    stats.inserted++
  }
}

async function migrateVehicles(pool: pg.Pool, supabase: ReturnType<typeof createServiceRoleClient>) {
  if (!shouldRun('vehicles')) return

  for (const [table, type, entityType] of [
    ['Truck', 'truck', 'vehicle_truck'],
    ['Semi', 'semi', 'vehicle_semi'],
  ] as const) {
    const res = await pool.query<{
      id: string
      licensePlate: string
      brand: string
      model: string
      deletedAt: Date | null
    }>(`
      SELECT id, "licensePlate", brand, model, "deletedAt"
      FROM "${table}"
      WHERE "deletedAt" IS NULL
    `)

    for (const row of res.rows) {
      const existing = await findByLegacyId(supabase, entityType, row.id)
      if (existing) {
        stats.skipped++
        continue
      }

      const rowData = mapLegacyVehicleToInsert(row, type)

      if (dryRun) {
        stats.inserted++
        continue
      }

      const { data, error } = await supabase.from('vehicles').insert(rowData).select('id').single()
      if (error) {
        stats.errors++
        console.error(`${table} error`, row.id, error.message)
        continue
      }
      await saveMap(supabase, entityType, row.id, data.id)
      stats.inserted++
    }
  }
}

async function migrateDrivers(pool: pg.Pool, supabase: ReturnType<typeof createServiceRoleClient>) {
  if (!shouldRun('drivers')) return

  const res = await pool.query<{
    id: string
    fullName: string
    dni: string | null
    email: string | null
    deletedAt: Date | null
  }>(`
    SELECT id, "fullName", dni, email, "deletedAt"
    FROM "User"
    WHERE "workArea" = 'driver' AND "deletedAt" IS NULL
  `)

  for (const row of res.rows) {
    const existing = await findByLegacyId(supabase, 'driver', row.id)
    if (existing) {
      stats.skipped++
      continue
    }

    const rowData = mapLegacyDriverUserToInsert(row)

    if (dryRun) {
      stats.inserted++
      continue
    }

    const { data, error } = await supabase.from('drivers').insert(rowData).select('id').single()
    if (error) {
      stats.errors++
      console.error('Driver error', row.id, error.message)
      continue
    }
    await saveMap(supabase, 'driver', row.id, data.id)
    stats.inserted++
  }
}

async function migrateTrips(pool: pg.Pool, supabase: ReturnType<typeof createServiceRoleClient>) {
  if (!shouldRun('trips')) return

  const res = await pool.query<{
    id: string
    numberTrip: string
    numberOfClients: string
    source: string
    destination: string
    loadOriginDate: Date
    estimatedDeliveryDate: Date
    type: string
    status: string
    totalPallets: number
    totalPackages: number
    kmArcorSystem: number | null
    kmRealDriver: number | null
    kmSatelliteGoogle: number | null
    clientId: string
    driverId: string
    truckId: string
    semiId: string
    createdById: string
    pdfFileUrl: string | null
    pdfUploadedById: string | null
    deletedAt: Date | null
  }>(`
    SELECT
      id, "numberTrip", "numberOfClients", source, destination,
      "loadOriginDate", "estimatedDeliveryDate", type, status,
      "totalPallets", "totalPackages",
      "kmArcorSystem", "kmRealDriver", "kmSatelliteGoogle",
      "clientId", "driverId", "truckId", "semiId",
      "createdById", "pdfFileUrl", "pdfUploadedById", "deletedAt"
    FROM "Travel"
    WHERE "deletedAt" IS NULL
  `)

  for (const row of res.rows) {
    const existing = await findByLegacyId(supabase, 'trip', row.id)
    if (existing) {
      stats.skipped++
      continue
    }

    const [arcorClientId, vehicleId, trailerId, driverId] = await Promise.all([
      findByLegacyId(supabase, 'client', row.clientId),
      findByLegacyId(supabase, 'vehicle_truck', row.truckId),
      findByLegacyId(supabase, 'vehicle_semi', row.semiId),
      findByLegacyId(supabase, 'driver', row.driverId),
    ])

    if (!arcorClientId || !vehicleId || !trailerId || !driverId) {
      stats.errors++
      console.error('Trip FK missing', row.id, { arcorClientId, vehicleId, trailerId, driverId })
      continue
    }

    const pdfUploadedBy = await resolveProfileByLegacyUserId(supabase, pool, row.pdfUploadedById)

    const travel = {
      id: row.id,
      numberTrip: row.numberTrip,
      numberOfClients: row.numberOfClients,
      source: row.source,
      destination: row.destination,
      loadOriginDate: row.loadOriginDate.toISOString(),
      estimatedDeliveryDate: row.estimatedDeliveryDate.toISOString(),
      type: row.type as 'REFRIGERATED' | 'DRY',
      status: row.status as 'IN_PROGRESS' | 'DELIVERED' | 'INCOMPLETE' | 'PENDING_WIRTRACK' | 'SENT' | 'PENDING_PAYMENT' | 'PAID',
      totalPallets: row.totalPallets,
      totalPackages: row.totalPackages,
      kmArcorSystem: row.kmArcorSystem,
      kmRealDriver: row.kmRealDriver,
      kmSatelliteGoogle: row.kmSatelliteGoogle,
      clientId: row.clientId,
      driverId: row.driverId,
      truckId: row.truckId,
      semiId: row.semiId,
      createdById: row.createdById,
      pdfFileUrl: row.pdfFileUrl,
      pdfUploadedById: row.pdfUploadedById,
      deletedAt: null,
      createdAt: row.loadOriginDate.toISOString(),
      updatedAt: row.loadOriginDate.toISOString(),
    }

    const tripRow = mapLegacyTravelToTripInsert(travel, {
      arcor_client_id: arcorClientId,
      vehicle_id: vehicleId,
      trailer_id: trailerId,
      driver_id: driverId,
      pdf_uploaded_by: pdfUploadedBy,
    })

    if (dryRun) {
      stats.inserted++
      continue
    }

    const { data, error } = await supabase.from('trips').insert(tripRow).select('id').single()
    if (error) {
      stats.errors++
      console.error('Trip error', row.id, error.message)
      continue
    }

    await saveMap(supabase, 'trip', row.id, data.id)

    const pdfKey = legacyPdfStorageKey(row.pdfFileUrl)
    if (pdfKey) {
      const { error: docError } = await supabase
        .from('trip_documents')
        .insert(mapLegacyPdfDocument(data.id, pdfKey))
      if (docError) {
        stats.warnings.push(`PDF doc trip ${row.id}: ${docError.message}`)
      }
    }

    stats.inserted++
  }
}

async function migrateObservations(pool: pg.Pool, supabase: ReturnType<typeof createServiceRoleClient>) {
  if (!shouldRun('observations')) return

  const res = await pool.query<{
    id: string
    content: string
    travelId: string
    createdAt: Date
    updatedAt: Date
  }>(`
    SELECT id, content, "travelId", "createdAt", "updatedAt"
    FROM "Observation"
  `)

  for (const row of res.rows) {
    const existing = await findByLegacyId(supabase, 'observation', row.id)
    if (existing) {
      stats.skipped++
      continue
    }

    const tripId = await findByLegacyId(supabase, 'trip', row.travelId)
    if (!tripId) {
      stats.warnings.push(`Observation ${row.id}: viaje ${row.travelId} no encontrado`)
      continue
    }

    if (dryRun) {
      stats.inserted++
      continue
    }

    const { data, error } = await supabase
      .from('trip_observations')
      .insert({
        trip_id: tripId,
        content: row.content,
        legacy_id: row.id,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      stats.errors++
      console.error('Observation error', row.id, error.message)
      continue
    }

    await saveMap(supabase, 'observation', row.id, data.id)
    stats.inserted++
  }
}

async function dryRunPreview(pool: pg.Pool) {
  console.log('\nConteo en Neon (sin escribir en Supabase):\n')

  if (shouldRun('clients')) {
    const r = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "Client"`)
    console.log(`  Clientes (Arcor): ${r.rows[0].n}`)
    stats.inserted += r.rows[0].n
  }
  if (shouldRun('vehicles')) {
    const trucks = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM "Truck" WHERE "deletedAt" IS NULL`
    )
    const semis = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM "Semi" WHERE "deletedAt" IS NULL`
    )
    console.log(`  Camiones:        ${trucks.rows[0].n}`)
    console.log(`  Semis:           ${semis.rows[0].n}`)
    stats.inserted += trucks.rows[0].n + semis.rows[0].n
  }
  if (shouldRun('drivers')) {
    const r = await pool.query<{ n: number }>(`
      SELECT COUNT(*)::int AS n FROM "User"
      WHERE "workArea" = 'driver' AND "deletedAt" IS NULL
    `)
    console.log(`  Choferes:        ${r.rows[0].n}`)
    stats.inserted += r.rows[0].n
  }
  if (shouldRun('trips')) {
    const r = await pool.query<{ n: number; with_pdf: number }>(`
      SELECT COUNT(*)::int AS n,
        COUNT(*) FILTER (WHERE "pdfFileUrl" IS NOT NULL)::int AS with_pdf
      FROM "Travel" WHERE "deletedAt" IS NULL
    `)
    console.log(`  Viajes:          ${r.rows[0].n} (${r.rows[0].with_pdf} con PDF)`)
    stats.inserted += r.rows[0].n
  }
  if (shouldRun('observations')) {
    const r = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "Observation"`)
    console.log(`  Observaciones:   ${r.rows[0].n}`)
    stats.inserted += r.rows[0].n
  }
}

async function main() {
  loadEnvLocal()
  console.log(`Migración legacy → Supabase${dryRun ? ' (DRY RUN)' : ''}`)
  if (only) console.log('Secciones:', only.join(', '))

  const pool = await getLegacyPool()

  if (dryRun) {
    try {
      await dryRunPreview(pool)
    } finally {
      await pool.end()
    }
    console.log('\n--- Resumen (dry-run) ---')
    console.log('Registros a migrar (aprox.):', stats.inserted)
    console.log('No se escribió nada en Supabase ni se modificó Neon.')
    return
  }

  const supabase = createServiceRoleClient()

  try {
    console.log('Migrando clientes operativos (arcor_clients)...')
    await migrateClients(pool, supabase)
    console.log('Migrando vehículos...')
    await migrateVehicles(pool, supabase)
    console.log('Migrando choferes...')
    await migrateDrivers(pool, supabase)
    console.log('Migrando viajes...')
    await migrateTrips(pool, supabase)
    console.log('Migrando observaciones...')
    await migrateObservations(pool, supabase)
  } finally {
    await pool.end()
  }

  console.log('\n--- Resumen ---')
  console.log('Insertados:', stats.inserted)
  console.log('Omitidos (ya existían):', stats.skipped)
  console.log('Errores:', stats.errors)
  if (stats.warnings.length) {
    console.log('\nWarnings:')
    stats.warnings.forEach((w) => console.log(' -', w))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
