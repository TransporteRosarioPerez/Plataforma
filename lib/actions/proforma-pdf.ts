'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { OPERATIONAL_TRIP_STATUSES, type TripStatus } from '@/lib/types'
import { roundCents } from '@/lib/pdf/numbers'
import type { TripMatch, TripMatchKind } from '@/lib/proformas/pdf-review'

export type ProformaPdfMatchInput = {
  proformaNumber: string
  cuit: string | null
  codes: string[]
}

export type ProformaPdfGroupMatch = {
  proformaNumber: string
  /** Cliente cuyo CUIT coincide con el del PDF. */
  clientId: string | null
  clientName: string | null
  /** Si ya hay una proforma activa con ese número. */
  existingProformaNumber: string | null
  matches: Record<string, TripMatch | null>
}

export type ProformaPdfMatchResult =
  | ({ ok: true } & Omit<ProformaPdfGroupMatch, 'proformaNumber'>)
  | { ok: false; error: string }

export type ProformaPdfBatchResult =
  | { ok: true; groups: ProformaPdfGroupMatch[] }
  | { ok: false; error: string }

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Busca los viajes por número de carga (trips.code) y decide cómo entra cada
 * uno: libre, compartido con otra compañía, ajuste (ya facturado para esta
 * compañía) o no facturable. No guarda nada.
 */
async function matchGroups(
  supabase: Supabase,
  inputs: ProformaPdfMatchInput[]
): Promise<ProformaPdfBatchResult> {
  const allCodes = Array.from(
    new Set(inputs.flatMap((g) => g.codes.map((c) => c.trim()).filter(Boolean)))
  )
  if (allCodes.length === 0) return { ok: false, error: 'El PDF no trae viajes' }
  if (allCodes.length > 1000) return { ok: false, error: 'Demasiados viajes en un solo PDF' }

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, cuit')
    .is('deleted_at', null)
  if (clientsError) return { ok: false, error: clientsError.message }
  const clientByCuit = new Map(
    (clients ?? [])
      .filter((c) => c.cuit)
      .map((c) => [String(c.cuit).replace(/\D/g, ''), { id: c.id as string, name: c.name as string }])
  )

  const numbers = inputs.map((g) => g.proformaNumber)
  const { data: existing, error: existingError } = await supabase
    .from('proformas')
    .select('proforma_number')
    .in('proforma_number', numbers)
    .is('deleted_at', null)
  if (existingError) return { ok: false, error: existingError.message }
  const existingNumbers = new Set((existing ?? []).map((p) => p.proforma_number as string))

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, code, status, unit_price, total_pallets')
    .in('code', allCodes)
    .is('deleted_at', null)
  if (tripsError) return { ok: false, error: tripsError.message }

  const tripIds = (trips ?? []).map((t) => t.id as string)
  const { data: lines, error: linesError } = tripIds.length
    ? await supabase
        .from('proforma_line_items')
        .select('trip_id, proformas!inner(proforma_number, client_id, deleted_at)')
        .in('trip_id', tripIds)
        .is('proformas.deleted_at', null)
    : { data: [], error: null }
  if (linesError) return { ok: false, error: linesError.message }

  type ProformaRef = { proforma_number: string; client_id: string | null }
  type LineRow = { trip_id: string; proformas: ProformaRef | ProformaRef[] }
  const proformasByTrip = new Map<string, { number: string; clientId: string | null }[]>()
  for (const line of (lines ?? []) as LineRow[]) {
    const p = Array.isArray(line.proformas) ? line.proformas[0] : line.proformas
    if (!p) continue
    const list = proformasByTrip.get(line.trip_id) ?? []
    list.push({ number: p.proforma_number, clientId: p.client_id })
    proformasByTrip.set(line.trip_id, list)
  }

  const tripByCode = new Map((trips ?? []).map((t) => [t.code as string, t]))
  const operational = new Set<TripStatus>(OPERATIONAL_TRIP_STATUSES)

  const groups: ProformaPdfGroupMatch[] = inputs.map((input) => {
    const client = input.cuit ? clientByCuit.get(input.cuit) ?? null : null
    const matches: Record<string, TripMatch | null> = {}
    for (const code of input.codes) {
      const trip = tripByCode.get(code)
      if (!trip) {
        matches[code] = null
        continue
      }
      const others = (proformasByTrip.get(trip.id) ?? []).filter(
        (p) => p.number !== input.proformaNumber
      )
      const status = trip.status as TripStatus
      const billedBefore = status === 'paid' || status === 'pending_payment'

      let kind: TripMatchKind
      if (others.some((p) => client && p.clientId === client.id)) kind = 'adjustment'
      else if (others.length > 0) kind = 'shared'
      else if (billedBefore) kind = 'adjustment' // facturado en el sistema anterior
      else if (operational.has(status)) kind = 'free'
      else kind = 'not_billable'

      const unit = trip.unit_price == null ? null : Number(trip.unit_price)
      const pallets = trip.total_pallets == null ? null : Number(trip.total_pallets)
      matches[code] = {
        tripId: trip.id as string,
        code,
        status,
        kind,
        otherProformas: others.map((p) => p.number),
        estimate: unit && pallets && unit > 0 && pallets > 0 ? roundCents(unit * pallets) : null,
      }
    }
    return {
      proformaNumber: input.proformaNumber,
      clientId: client?.id ?? null,
      clientName: client?.name ?? null,
      existingProformaNumber: existingNumbers.has(input.proformaNumber) ? input.proformaNumber : null,
      matches,
    }
  })

  return { ok: true, groups }
}

/** Una proforma (la que se carga en "Nueva proforma"). */
export async function matchProformaPdf(input: ProformaPdfMatchInput): Promise<ProformaPdfMatchResult> {
  await requireSession()
  const supabase = await createClient()
  const res = await matchGroups(supabase, [input])
  if (!res.ok) return res
  const { proformaNumber: _n, ...group } = res.groups[0]
  return { ok: true, ...group }
}

/** Todas las proformas de un PDF en una sola consulta ("Importar PDF"). */
export async function matchProformaPdfBatch(inputs: ProformaPdfMatchInput[]): Promise<ProformaPdfBatchResult> {
  await requireSession()
  if (inputs.length === 0) return { ok: false, error: 'El PDF no trae proformas' }
  if (inputs.length > 60) return { ok: false, error: 'Demasiadas proformas en un solo PDF' }
  const supabase = await createClient()
  const res = await matchGroups(supabase, inputs)
  if (!res.ok) return res

  // Un viaje que está en dos proformas del mismo PDF (ej. Arcor y Bagley) es compartido
  const groupsByCode = new Map<string, number>()
  for (const input of inputs) {
    for (const code of new Set(input.codes)) groupsByCode.set(code, (groupsByCode.get(code) ?? 0) + 1)
  }
  for (const group of res.groups) {
    for (const match of Object.values(group.matches)) {
      if (match && match.kind === 'free' && (groupsByCode.get(match.code) ?? 0) > 1) match.kind = 'shared'
    }
  }
  return res
}
