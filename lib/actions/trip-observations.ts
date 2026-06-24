'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { tripObservationSchema } from '@/lib/validations/trip-observations'

function revalidateTripPaths(tripId: string) {
  revalidatePath('/app/viajes')
  revalidatePath(`/app/viajes/${tripId}`)
  revalidatePath('/app/papelera')
}

async function assertActiveTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string
): Promise<ActionState | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .is('deleted_at', null)
    .single()

  if (error || !data) return { error: 'Viaje no encontrado' }
  return null
}

export async function upsertTripObservation(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(tripObservationSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()
  const tripError = await assertActiveTrip(supabase, parsed.data.trip_id)
  if (tripError) return tripError

  const row = {
    trip_id: parsed.data.trip_id,
    content: parsed.data.content.trim(),
  }

  if (parsed.data.id) {
    const { error } = await supabase
      .from('trip_observations')
      .update(row)
      .eq('id', parsed.data.id)
      .eq('trip_id', parsed.data.trip_id)
      .is('deleted_at', null)

    if (error) return { error: error.message }
    await logAudit({
      action: AUDIT_ACTIONS.tripObservationUpsert,
      entityType: 'trip_observation',
      entityId: parsed.data.id,
      summary: 'Actualizó una observación de viaje',
      metadata: { tripId: parsed.data.trip_id },
    })
    revalidateTripPaths(parsed.data.trip_id)
    return { success: 'Observación actualizada' }
  }

  const { error } = await supabase.from('trip_observations').insert(row)
  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.tripObservationUpsert,
    entityType: 'trip',
    entityId: parsed.data.trip_id,
    summary: 'Agregó una observación a un viaje',
  })

  revalidateTripPaths(parsed.data.trip_id)
  return { success: 'Observación agregada' }
}

export async function deleteTripObservation(id: string, tripId: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const tripError = await assertActiveTrip(supabase, tripId)
  if (tripError) return tripError

  const { error } = await supabase
    .from('trip_observations')
    .update(softDeleteUpdate())
    .eq('id', id)
    .eq('trip_id', tripId)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.tripObservationDelete,
    entityType: 'trip_observation',
    entityId: id,
    summary: 'Eliminó una observación de viaje',
    metadata: { tripId },
  })

  revalidateTripPaths(tripId)
  return { success: 'Observación dada de baja. Podés recuperarla desde Papelera.' }
}
