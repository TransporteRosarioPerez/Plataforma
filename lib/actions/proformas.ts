'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { createProformaSchema, updateProformaSchema } from '@/lib/validations/proformas'
import { OPERATIONAL_TRIP_STATUSES } from '@/lib/types'
import type { TripStatus } from '@/lib/types'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import {
  applyProformaLineItemsToTrips,
  loadProformaLineAmounts,
  revertTripsAfterProformaRemoved,
} from '@/lib/proformas/trip-billing-sync'

function normalizeLineItems(raw: { trip_id: string; amount: number; taxes?: number }[]) {
  return raw.map((item) => ({
    trip_id: item.trip_id,
    amount: item.amount,
    taxes: 0,
  }))
}

function parseLineItems(raw: string): { trip_id: string; amount: number; taxes: number }[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return normalizeLineItems(
      parsed
        .map((item) => {
          const row = item as Record<string, unknown>
          return {
            trip_id: String(row.trip_id ?? ''),
            amount: Number(row.amount ?? 0),
            taxes: Number(row.taxes ?? 0),
          }
        })
        .filter((item) => item.trip_id)
    )
  } catch {
    return []
  }
}

async function getAssignedTripIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  excludeProformaId?: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('proformas')
    .select('id, trip_ids, status')
    .is('deleted_at', null)
    .in('status', ['pendiente', 'facturada'])

  if (error) throw new Error(error.message)

  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (excludeProformaId && row.id === excludeProformaId) continue
    for (const tripId of row.trip_ids ?? []) {
      ids.add(tripId)
    }
  }
  return ids
}

async function validateTripsForProforma(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripIds: string[],
  excludeProformaId?: string
): Promise<ActionState | null> {
  if (tripIds.length === 0) return { error: 'Seleccioná al menos un viaje' }

  const assigned = await getAssignedTripIds(supabase, excludeProformaId)
  const overlap = tripIds.filter((id) => assigned.has(id))
  if (overlap.length > 0) {
    return { error: 'Uno o más viajes ya están en otra proforma activa' }
  }

  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, status')
    .is('deleted_at', null)
    .in('id', tripIds)

  if (error) return { error: error.message }
  if (!trips || trips.length !== tripIds.length) {
    return { error: 'Uno o más viajes no existen' }
  }

  const billableStatuses = new Set<TripStatus>(OPERATIONAL_TRIP_STATUSES)
  const notBillable = trips.filter((t) => !billableStatuses.has(t.status as TripStatus))
  if (notBillable.length > 0) {
    return {
      error:
        'Solo se pueden incluir viajes operativos (no pagados ni ya en cobranza). Los importes se cargan en la proforma.',
    }
  }

  return null
}

function sumLineItems(items: { amount: number; taxes: number }[]) {
  return items.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal + item.amount,
      taxes: acc.taxes + item.taxes,
    }),
    { subtotal: 0, taxes: 0 }
  )
}

export async function createProforma(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(createProformaSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const lineItems = parseLineItems(parsed.data.line_items)
  const tripIds = lineItems.map((item) => item.trip_id)

  const supabase = await createClient()

  const { count: clientCount } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)

  if ((clientCount ?? 0) === 0) {
    return { error: 'Cargá al menos un cliente en Clientes' }
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', parsed.data.client_id)
    .is('deleted_at', null)
    .single()

  if (clientError || !client) return { error: 'Cliente no encontrado' }

  const validationError = await validateTripsForProforma(supabase, tripIds)
  if (validationError) return validationError

  if (lineItems.some((item) => item.amount <= 0)) {
    return { error: 'Cada viaje debe tener un importe mayor a 0 en la proforma' }
  }

  const totals = sumLineItems(lineItems)
  const total = totals.subtotal

  const { data: proforma, error } = await supabase
    .from('proformas')
    .insert({
      proforma_number: parsed.data.proforma_number,
      client_id: client.id,
      client_name: client.name,
      trip_ids: tripIds,
      subtotal: totals.subtotal,
      taxes: 0,
      total,
      status: 'pendiente',
      received_date: parsed.data.received_date,
      notes: parsed.data.notes || null,
      file_name: parsed.data.file_name || null,
      file_url: parsed.data.file_url || null,
    })
    .select('id')
    .single()

  if (error || !proforma) return { error: error?.message ?? 'Error al crear proforma' }

  const { error: linesError } = await supabase.from('proforma_line_items').insert(
    lineItems.map((item) => ({
      proforma_id: proforma.id,
      trip_id: item.trip_id,
      amount: item.amount,
      taxes: item.taxes,
    }))
  )

  if (linesError) {
    await supabase.from('proformas').update(softDeleteUpdate()).eq('id', proforma.id)
    return { error: linesError.message }
  }

  await applyProformaLineItemsToTrips(supabase, lineItems, 'pending_payment')

  await logAudit({
    action: AUDIT_ACTIONS.proformaCreate,
    entityType: 'proforma',
    entityId: proforma.id,
    entityLabel: parsed.data.proforma_number,
    summary: `Creó la proforma ${parsed.data.proforma_number} con ${tripIds.length} viaje(s)`,
    metadata: { tripCount: tripIds.length, clientName: client.name },
  })

  revalidatePath('/app/proformas')
  revalidatePath('/app/viajes')
  revalidatePath('/app/reportes')
  for (const tripId of tripIds) {
    revalidatePath(`/app/viajes/${tripId}`)
  }

  return { success: `Proforma creada con ${tripIds.length} viaje(s)` }
}

export async function updateProforma(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(updateProformaSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('proformas')
    .select('id, trip_ids, status')
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) return { error: 'Proforma no encontrada' }

  const { error } = await supabase
    .from('proformas')
    .update({
      proforma_number: parsed.data.proforma_number,
      subtotal: parsed.data.subtotal,
      taxes: 0,
      total: parsed.data.subtotal,
      received_date: parsed.data.received_date,
      notes: parsed.data.notes || null,
      ...(parsed.data.file_url
        ? { file_url: parsed.data.file_url, file_name: parsed.data.file_name || null }
        : {}),
    })
    .eq('id', parsed.data.id)

  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.proformaUpdate,
    entityType: 'proforma',
    entityId: parsed.data.id,
    entityLabel: parsed.data.proforma_number,
    summary: `Actualizó la proforma ${parsed.data.proforma_number}`,
  })

  const tripIds: string[] = existing.trip_ids ?? []

  revalidatePath('/app/proformas')
  revalidatePath('/app/viajes')
  revalidatePath('/app/reportes')
  for (const tripId of tripIds) {
    revalidatePath(`/app/viajes/${tripId}`)
  }

  return { success: 'Proforma actualizada' }
}

export async function deleteProforma(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('proformas')
    .select('trip_ids, proforma_number')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!existing) return { error: 'Proforma no encontrada' }

  const { data: activeInvoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('proforma_id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (activeInvoice) {
    return { error: 'No se puede dar de baja: la proforma tiene una factura vinculada. Eliminá la factura primero.' }
  }

  const tripIdsToRevert: string[] = existing.trip_ids ?? []

  const { error } = await supabase
    .from('proformas')
    .update(softDeleteUpdate())
    .eq('id', id)
    .is('deleted_at', null)
  if (error) return { error: error.message }

  await revertTripsAfterProformaRemoved(supabase, tripIdsToRevert)

  await logAudit({
    action: AUDIT_ACTIONS.proformaDelete,
    entityType: 'proforma',
    entityId: id,
    entityLabel: existing.proforma_number ?? undefined,
    summary: `Eliminó la proforma ${existing.proforma_number ?? id}`,
  })

  revalidatePath('/app/proformas')
  revalidatePath('/app/viajes')
  revalidatePath('/app/papelera')
  revalidatePath('/app/reportes')
  for (const tripId of tripIdsToRevert) {
    revalidatePath(`/app/viajes/${tripId}`)
  }

  return { success: 'Proforma dada de baja. Podés recuperarla desde Papelera.' }
}
