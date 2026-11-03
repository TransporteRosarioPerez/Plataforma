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
  revertTripsAfterProformaRemoved,
} from '@/lib/proformas/trip-billing-sync'
import { calculateInvoiceAmounts } from '@/lib/invoices/calculate'

type ParsedLineItem = {
  trip_id: string
  amount: number
  taxes: number
  is_adjustment: boolean
  adjustment_reason: string | null
}

function parseLineItems(raw: string): ParsedLineItem[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        const row = item as Record<string, unknown>
        const isAdjustment = row.is_adjustment === true
        const reason = typeof row.adjustment_reason === 'string' ? row.adjustment_reason.trim() : ''
        return {
          trip_id: String(row.trip_id ?? ''),
          amount: Math.round(Number(row.amount ?? 0) * 100) / 100,
          taxes: 0,
          is_adjustment: isAdjustment,
          adjustment_reason: isAdjustment && reason ? reason : null,
        }
      })
      .filter((item) => item.trip_id && Number.isFinite(item.amount))
  } catch {
    return []
  }
}

function validateLineAmounts(lineItems: ParsedLineItem[]): ActionState | null {
  if (lineItems.some((item) => !item.is_adjustment && item.amount <= 0)) {
    return { error: 'Cada viaje debe tener un importe mayor a 0 en la proforma' }
  }
  if (lineItems.some((item) => item.is_adjustment && item.amount === 0)) {
    return { error: 'Cada ajuste de viaje debe tener una diferencia distinta de 0' }
  }
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  if (subtotal <= 0) {
    return { error: 'El neto de la proforma tiene que ser mayor a 0' }
  }
  return null
}

function lineItemRows(proformaId: string, lineItems: ParsedLineItem[]) {
  return lineItems.map((item) => ({
    proforma_id: proformaId,
    trip_id: item.trip_id,
    amount: item.amount,
    taxes: 0,
    is_adjustment: item.is_adjustment,
    adjustment_reason: item.adjustment_reason,
  }))
}

/**
 * Un ajuste solo tiene sentido sobre un viaje que ya se facturó: o está en otra
 * proforma activa, o vino del sistema anterior en Pagado / Pendiente de pago.
 * En este último caso guarda su ingreso de origen como base (legacy_income)
 * para que el ajuste se sume sobre él y no lo pise.
 */
async function validateAdjustmentTrips(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripIds: string[],
  excludeProformaId?: string
): Promise<ActionState | null> {
  if (tripIds.length === 0) return null

  const assigned = await getAssignedTripIds(supabase, excludeProformaId)
  const notAssigned = tripIds.filter((id) => !assigned.has(id))
  if (notAssigned.length === 0) return null

  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, code, status, total_income, legacy_billing_status')
    .in('id', notAssigned)
    .is('deleted_at', null)
  if (error) return { error: error.message }

  // ¿Tiene alguna línea en proformas activas (incluida la que se edita)?
  const { data: lines } = await supabase
    .from('proforma_line_items')
    .select('trip_id, proformas!inner(deleted_at)')
    .in('trip_id', notAssigned)
    .is('proformas.deleted_at', null)
  const withLines = new Set((lines ?? []).map((l) => l.trip_id as string))

  const toInit: { id: string; status: string; income: number }[] = []
  const invalid: string[] = []
  for (const trip of trips ?? []) {
    if (trip.legacy_billing_status) continue
    const isBilled = trip.status === 'paid' || trip.status === 'pending_payment'
    if (isBilled && !withLines.has(trip.id)) {
      toInit.push({ id: trip.id, status: trip.status, income: Number(trip.total_income ?? 0) })
    } else {
      invalid.push(trip.code)
    }
  }
  if ((trips ?? []).length !== notAssigned.length) return { error: 'Uno o más viajes no existen' }

  if (invalid.length > 0) {
    return {
      error: `Solo se puede ajustar un viaje ya facturado o cobrado (${invalid.join(', ')} no lo está). Agregalo con “Elegir viajes”.`,
    }
  }

  for (const trip of toInit) {
    const { error: initError } = await supabase
      .from('trips')
      .update({ legacy_billing_status: trip.status, legacy_income: trip.income })
      .eq('id', trip.id)
      .is('legacy_billing_status', null)
    if (initError) return { error: initError.message }
  }

  return null
}

async function logTripAdjustments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proformaNumber: string,
  adjustments: ParsedLineItem[]
) {
  if (adjustments.length === 0) return
  const { data: trips } = await supabase
    .from('trips')
    .select('id, code')
    .in(
      'id',
      adjustments.map((a) => a.trip_id)
    )
  const codeById = new Map((trips ?? []).map((t) => [t.id as string, t.code as string]))
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)

  for (const adj of adjustments) {
    const code = codeById.get(adj.trip_id) ?? adj.trip_id
    await logAudit({
      action: AUDIT_ACTIONS.tripAdjustment,
      entityType: 'trip',
      entityId: adj.trip_id,
      entityLabel: code,
      summary: `Ajuste de ${adj.amount > 0 ? '+' : ''}${fmt(adj.amount)} al viaje ${code} en la proforma ${proformaNumber}${adj.adjustment_reason ? ` (${adj.adjustment_reason})` : ''}`,
      metadata: {
        proformaNumber,
        amount: adj.amount,
        reason: adj.adjustment_reason,
      },
    })
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
    .in('status', ['pendiente', 'facturada', 'cobrada'])

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
  if (tripIds.length === 0) return null

  const assigned = await getAssignedTripIds(supabase, excludeProformaId)

  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, status, code')
    .is('deleted_at', null)
    .in('id', tripIds)

  if (error) return { error: error.message }
  if (!trips || trips.length !== tripIds.length) {
    return { error: 'Uno o más viajes no existen' }
  }

  const billableStatuses = new Set<TripStatus>(OPERATIONAL_TRIP_STATUSES)
  const freeTrips = trips.filter((t) => !assigned.has(t.id))
  const notBillable = freeTrips.filter((t) => !billableStatuses.has(t.status as TripStatus))
  if (notBillable.length > 0) {
    return {
      error:
        'Solo se pueden incluir viajes operativos libres, o viajes ya en otra proforma vía “Agregar viaje compartido”.',
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

  if (lineItems.length === 0) return { error: 'Seleccioná al menos un viaje' }
  if (new Set(tripIds).size !== tripIds.length) {
    return { error: 'Un viaje no puede estar dos veces en la misma proforma' }
  }

  const amountsError = validateLineAmounts(lineItems)
  if (amountsError) return amountsError

  const adjustments = lineItems.filter((item) => item.is_adjustment)
  const regularTripIds = lineItems.filter((item) => !item.is_adjustment).map((item) => item.trip_id)

  const validationError = await validateTripsForProforma(supabase, regularTripIds)
  if (validationError) return validationError

  const adjustmentError = await validateAdjustmentTrips(
    supabase,
    adjustments.map((item) => item.trip_id)
  )
  if (adjustmentError) return adjustmentError

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

  const { error: linesError } = await supabase
    .from('proforma_line_items')
    .insert(lineItemRows(proforma.id, lineItems))

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
    summary:
      adjustments.length > 0
        ? `Creó la proforma ${parsed.data.proforma_number} con ${tripIds.length} viaje(s), ${adjustments.length} de ajuste`
        : `Creó la proforma ${parsed.data.proforma_number} con ${tripIds.length} viaje(s)`,
    metadata: {
      tripCount: tripIds.length,
      adjustmentCount: adjustments.length,
      clientName: client.name,
    },
  })

  await logTripAdjustments(supabase, parsed.data.proforma_number, adjustments)

  revalidatePath('/app/proformas')
  revalidatePath('/app/viajes')
  revalidatePath('/app/reportes')
  for (const tripId of tripIds) {
    revalidatePath(`/app/viajes/${tripId}`)
  }

  return {
    success:
      adjustments.length > 0
        ? `Proforma creada con ${tripIds.length} viaje(s) (${adjustments.length} ajuste${adjustments.length === 1 ? '' : 's'})`
        : `Proforma creada con ${tripIds.length} viaje(s)`,
  }
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

  const previousTripIds: string[] = existing.trip_ids ?? []
  let subtotal = parsed.data.subtotal
  let syncedInvoice = false
  let nextTripIds = previousTripIds
  let newAdjustments: ParsedLineItem[] = []

  if (parsed.data.line_items != null && parsed.data.line_items !== '') {
    const lineItems = parseLineItems(parsed.data.line_items)
    if (lineItems.length === 0) {
      return { error: 'La proforma debe tener al menos un viaje con importe' }
    }

    const amountsError = validateLineAmounts(lineItems)
    if (amountsError) return amountsError

    nextTripIds = lineItems.map((item) => item.trip_id)
    if (new Set(nextTripIds).size !== nextTripIds.length) {
      return { error: 'Un viaje no puede estar dos veces en la misma proforma' }
    }
    const previousSet = new Set(previousTripIds)
    const nextSet = new Set(nextTripIds)
    const addedTripIds = nextTripIds.filter((id) => !previousSet.has(id))
    const removedTripIds = previousTripIds.filter((id) => !nextSet.has(id))

    const adjustmentTripIds = new Set(
      lineItems.filter((item) => item.is_adjustment).map((item) => item.trip_id)
    )

    if (addedTripIds.length > 0) {
      const validationError = await validateTripsForProforma(
        supabase,
        addedTripIds.filter((id) => !adjustmentTripIds.has(id)),
        parsed.data.id
      )
      if (validationError) return validationError
    }

    const adjustmentError = await validateAdjustmentTrips(
      supabase,
      Array.from(adjustmentTripIds),
      parsed.data.id
    )
    if (adjustmentError) return adjustmentError

    // Para el registro en el viaje: ajustes nuevos o con importe/motivo cambiado
    const { data: previousLines } = await supabase
      .from('proforma_line_items')
      .select('trip_id, amount, is_adjustment, adjustment_reason')
      .eq('proforma_id', parsed.data.id)
    const previousByTrip = new Map(
      (previousLines ?? []).map((row) => [row.trip_id as string, row])
    )
    newAdjustments = lineItems.filter((item) => {
      if (!item.is_adjustment) return false
      const prev = previousByTrip.get(item.trip_id)
      return (
        !prev ||
        prev.is_adjustment !== true ||
        Number(prev.amount) !== item.amount ||
        (prev.adjustment_reason ?? null) !== item.adjustment_reason
      )
    })

    subtotal = sumLineItems(lineItems).subtotal

    const { error: deleteLinesError } = await supabase
      .from('proforma_line_items')
      .delete()
      .eq('proforma_id', parsed.data.id)

    if (deleteLinesError) return { error: deleteLinesError.message }

    const { error: insertLinesError } = await supabase
      .from('proforma_line_items')
      .insert(lineItemRows(parsed.data.id, lineItems))

    if (insertLinesError) return { error: insertLinesError.message }

    if (removedTripIds.length > 0) {
      await revertTripsAfterProformaRemoved(supabase, removedTripIds, { force: true })
    }

    await applyProformaLineItemsToTrips(supabase, lineItems)

    const { data: linkedInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('proforma_id', parsed.data.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (linkedInvoice) {
      const amounts = calculateInvoiceAmounts(subtotal)
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          subtotal: amounts.subtotal,
          iva: amounts.iva,
          total: amounts.total,
          trip_ids: nextTripIds,
        })
        .eq('id', linkedInvoice.id)

      if (invoiceError) return { error: invoiceError.message }
      syncedInvoice = true
    }
  }

  const { error } = await supabase
    .from('proformas')
    .update({
      proforma_number: parsed.data.proforma_number,
      trip_ids: nextTripIds,
      subtotal,
      taxes: 0,
      total: subtotal,
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
    summary: syncedInvoice
      ? `Actualizó la proforma ${parsed.data.proforma_number} y recalculó la factura vinculada`
      : `Actualizó la proforma ${parsed.data.proforma_number}`,
  })

  await logTripAdjustments(supabase, parsed.data.proforma_number, newAdjustments)

  const revalidateTripIds = Array.from(new Set([...previousTripIds, ...nextTripIds]))

  revalidatePath('/app/proformas')
  revalidatePath('/app/facturas')
  revalidatePath('/app/viajes')
  revalidatePath('/app/reportes')
  for (const tripId of revalidateTripIds) {
    revalidatePath(`/app/viajes/${tripId}`)
  }

  return {
    success: syncedInvoice
      ? 'Proforma actualizada. Se recalculó el neto, IVA y total de la factura vinculada.'
      : 'Proforma actualizada',
  }
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

export type SharedTripLookup = {
  tripId: string
  code: string
  origin: string
  destination: string | null
  status: string
  existingProformas: { id: string; proformaNumber: string; clientName: string; status: string }[]
}

export async function findSharedTripForProforma(
  code: string,
  options: { excludeProformaId?: string; excludeTripIds?: string[] } = {}
): Promise<{ trip?: SharedTripLookup; error?: string }> {
  await requireSession()
  const normalized = code.trim()
  if (!normalized) return { error: 'Ingresá el número de viaje' }

  const supabase = await createClient()

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, code, origin, destination, status')
    .ilike('code', normalized)
    .is('deleted_at', null)
    .maybeSingle()

  if (tripError) return { error: tripError.message }
  if (!trip) return { error: `No se encontró el viaje ${normalized}` }

  if (options.excludeTripIds?.includes(trip.id)) {
    return { error: 'Ese viaje ya está en esta proforma' }
  }

  const { data: proformas, error: proformasError } = await supabase
    .from('proformas')
    .select('id, proforma_number, client_name, status, trip_ids')
    .contains('trip_ids', [trip.id])
    .is('deleted_at', null)
    .in('status', ['pendiente', 'facturada', 'cobrada'])

  if (proformasError) return { error: proformasError.message }

  const others = (proformas ?? []).filter((p) => p.id !== options.excludeProformaId)
  if (others.length === 0) {
    return {
      error:
        'Ese viaje no está en otra proforma. Usá “Elegir viajes” para agregarlo como viaje libre.',
    }
  }

  return {
    trip: {
      tripId: trip.id,
      code: trip.code,
      origin: trip.origin ?? '',
      destination: trip.destination,
      status: trip.status,
      existingProformas: others.map((p) => ({
        id: p.id,
        proformaNumber: p.proforma_number,
        clientName: p.client_name,
        status: p.status,
      })),
    },
  }
}

