'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { createTripSchema, updateTripEstimateSchema } from '@/lib/validations/trips'

async function nextTripCode(supabase: Awaited<ReturnType<typeof createClient>>) {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
  const n = (count ?? 0) + 1
  return `VJ-${year}-${String(n).padStart(3, '0')}`
}

export async function createTrip(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(createTripSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()

  const [clientRes, vehicleRes, trailerRes, driverRes] = await Promise.all([
    supabase.from('arcor_clients').select('id, address').eq('id', parsed.data.client_id).is('deleted_at', null).single(),
    supabase.from('vehicles').select('id, type, status').eq('id', parsed.data.vehicle_id).is('deleted_at', null).single(),
    supabase.from('vehicles').select('id, type, status').eq('id', parsed.data.trailer_id).is('deleted_at', null).single(),
    supabase.from('drivers').select('id, status').eq('id', parsed.data.driver_id).is('deleted_at', null).single(),
  ])

  if (clientRes.error || !clientRes.data) return { error: 'Cliente no encontrado' }
  if (vehicleRes.error || !vehicleRes.data) return { error: 'Camión no encontrado' }
  if (vehicleRes.data.type !== 'truck') return { error: 'El vehículo seleccionado como camión debe ser tipo camión' }
  if (vehicleRes.data.status !== 'active') return { error: 'El camión debe estar activo' }
  if (trailerRes.error || !trailerRes.data) return { error: 'Semi/acoplado no encontrado' }
  if (trailerRes.data.type !== 'semi' && trailerRes.data.type !== 'trailer') {
    return { error: 'El semi/acoplado debe ser tipo semi o acoplado' }
  }
  if (trailerRes.data.status !== 'active') return { error: 'El semi/acoplado debe estar activo' }
  if (driverRes.error || !driverRes.data) return { error: 'Chofer no encontrado' }
  if (driverRes.data.status !== 'active') return { error: 'El chofer debe estar activo' }

  const code = await nextTripCode(supabase)

  const { data, error } = await supabase
    .from('trips')
    .insert({
      code,
      status: parsed.data.status,
      arcor_client_id: parsed.data.client_id,
      trip_type: parsed.data.trip_type,
      vehicle_id: parsed.data.vehicle_id,
      trailer_id: parsed.data.trailer_id,
      driver_id: parsed.data.driver_id,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      number_of_clients: parsed.data.number_of_clients,
      cargo_type: parsed.data.cargo_type,
      cargo_description: parsed.data.cargo_description || null,
      departure_date: parsed.data.departure_date || null,
      arrival_date: parsed.data.arrival_date || null,
      total_pallets: parsed.data.total_pallets ?? null,
      total_packages: parsed.data.total_packages ?? null,
      unit_price: parsed.data.unit_price ?? null,
      total_kilometers: parsed.data.total_kilometers ?? null,
      km_arcor_system: parsed.data.km_arcor_system ?? null,
      km_real_driver: parsed.data.km_real_driver ?? null,
      km_satellite_google: parsed.data.km_satellite_google ?? null,
      notes: parsed.data.notes || null,
      metadata: {},
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/app/viajes')
  redirect(`/app/viajes/${data.id}`)
}

export async function updateTripStatus(
  tripId: string,
  status: string
): Promise<ActionState> {
  await requireSession()

  if (status === 'paid') {
    return { error: 'Un viaje pasa a Pagado automáticamente al cobrar la proforma' }
  }
  if (status === 'pending_payment') {
    return { error: 'El estado Pendiente de pago se asigna al incluir el viaje en una proforma' }
  }

  const supabase = await createClient()

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('status')
    .eq('id', tripId)
    .is('deleted_at', null)
    .single()

  if (tripError || !trip) return { error: 'Viaje no encontrado' }
  if (trip.status === 'paid') {
    return { error: 'No se puede modificar el estado de un viaje ya pagado' }
  }
  if (trip.status === 'pending_payment') {
    return { error: 'El viaje está en cobranza. Gestioná el estado desde Proformas' }
  }

  const { error } = await supabase.from('trips').update({ status }).eq('id', tripId)
  if (error) return { error: error.message }
  revalidatePath('/app/viajes')
  revalidatePath(`/app/viajes/${tripId}`)
  return { success: 'Estado actualizado' }
}

export async function updateTripEstimate(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(updateTripEstimateSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('status')
    .eq('id', parsed.data.trip_id)
    .is('deleted_at', null)
    .single()

  if (tripError || !trip) return { error: 'Viaje no encontrado' }
  if (trip.status === 'pending_payment' || trip.status === 'paid') {
    return { error: 'No se puede modificar el estimado de un viaje en cobranza' }
  }

  const { error } = await supabase
    .from('trips')
    .update({
      unit_price: parsed.data.unit_price ?? null,
      total_pallets: parsed.data.total_pallets ?? null,
    })
    .eq('id', parsed.data.trip_id)

  if (error) return { error: error.message }

  revalidatePath('/app/viajes')
  revalidatePath(`/app/viajes/${parsed.data.trip_id}`)
  return { success: 'Estimado actualizado' }
}

export async function deleteTrip(id: string): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()
  const { error } = await supabase.from('trips').update(softDeleteUpdate()).eq('id', id).is('deleted_at', null)
  if (error) return { error: error.message }
  revalidatePath('/app/viajes')
  revalidatePath('/app/papelera')
  return { success: 'Viaje dado de baja. Podés recuperarlo desde Papelera.' }
}
