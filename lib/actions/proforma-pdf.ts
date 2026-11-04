'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { OPERATIONAL_TRIP_STATUSES, type TripStatus } from '@/lib/types'
import type { TripMatch, TripMatchKind } from '@/lib/proformas/pdf-review'

export type ProformaPdfMatchResult =
  | {
      ok: true
      /** Cliente cuyo CUIT coincide con el del PDF. */
      clientId: string | null
      /** Si ya hay una proforma activa con ese número. */
      existingProformaNumber: string | null
      matches: Record<string, TripMatch | null>
    }
  | { ok: false; error: string }

/**
 * Busca los viajes del PDF por número de carga (trips.code) y decide cómo
 * entra cada uno: libre, compartido con otra compañía, ajuste (ya facturado
 * para esta compañía) o no facturable. No guarda nada.
 */
export async function matchProformaPdf(input: {
  proformaNumber: string
  cuit: string | null
  codes: string[]
}): Promise<ProformaPdfMatchResult> {
  await requireSession()
  const supabase = await createClient()

  const codes = Array.from(new Set(input.codes.map((c) => c.trim()).filter(Boolean)))
  if (codes.length === 0) return { ok: false, error: 'El PDF no trae viajes' }
  if (codes.length > 500) return { ok: false, error: 'Demasiados viajes en un solo PDF' }

  const { data: clients } = input.cuit
    ? await supabase.from('clients').select('id').eq('cuit', input.cuit).is('deleted_at', null).limit(1)
    : { data: [] as { id: string }[] }
  const clientId = clients?.[0]?.id ?? null

  const { data: existing } = await supabase
    .from('proformas')
    .select('proforma_number')
    .eq('proforma_number', input.proformaNumber)
    .is('deleted_at', null)
    .maybeSingle()

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, code, status, legacy_billing_status')
    .in('code', codes)
    .is('deleted_at', null)
  if (tripsError) return { ok: false, error: tripsError.message }

  const tripIds = (trips ?? []).map((t) => t.id as string)
  const { data: lines, error: linesError } = tripIds.length
    ? await supabase
        .from('proforma_line_items')
        .select('trip_id, proformas!inner(proforma_number, client_id, status, deleted_at)')
        .in('trip_id', tripIds)
        .is('proformas.deleted_at', null)
    : { data: [], error: null }
  if (linesError) return { ok: false, error: linesError.message }

  type LineRow = {
    trip_id: string
    proformas: { proforma_number: string; client_id: string | null } | { proforma_number: string; client_id: string | null }[]
  }
  const proformasByTrip = new Map<string, { number: string; clientId: string | null }[]>()
  for (const line of (lines ?? []) as LineRow[]) {
    const p = Array.isArray(line.proformas) ? line.proformas[0] : line.proformas
    if (!p) continue
    const list = proformasByTrip.get(line.trip_id) ?? []
    list.push({ number: p.proforma_number, clientId: p.client_id })
    proformasByTrip.set(line.trip_id, list)
  }

  const operational = new Set<TripStatus>(OPERATIONAL_TRIP_STATUSES)
  const matches: Record<string, TripMatch | null> = Object.fromEntries(codes.map((c) => [c, null]))

  for (const trip of trips ?? []) {
    const others = (proformasByTrip.get(trip.id) ?? []).filter(
      (p) => p.number !== input.proformaNumber
    )
    const status = trip.status as TripStatus
    const billedBefore = status === 'paid' || status === 'pending_payment'

    let kind: TripMatchKind
    if (others.some((p) => clientId && p.clientId === clientId)) kind = 'adjustment'
    else if (others.length > 0) kind = 'shared'
    else if (billedBefore) kind = 'adjustment' // facturado en el sistema anterior
    else if (operational.has(status)) kind = 'free'
    else kind = 'not_billable'

    matches[trip.code as string] = {
      tripId: trip.id as string,
      code: trip.code as string,
      status,
      kind,
      otherProformas: others.map((p) => p.number),
    }
  }

  return {
    ok: true,
    clientId,
    existingProformaNumber: existing?.proforma_number ?? null,
    matches,
  }
}
