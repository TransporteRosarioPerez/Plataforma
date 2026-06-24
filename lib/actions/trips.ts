'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { createTripSchema, updateTripEstimateSchema, updateTripSchema } from '@/lib/validations/trips'

async function validateTripMasters(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: {
    client_id: string
    vehicle_id: string
    trailer_id: string
    driver_id: string
  },
  existing?: {
    vehicle_id?: string | null
    trailer_id?: string | null
    driver_id?: string | null
  }
): Promise<ActionState | null> {
  const [clientRes, vehicleRes, trailerRes, driverRes] = await Promise.all([
    supabase.from('arcor_clients').select('id').eq('id', data.client_id).is('deleted_at', null).single(),
    supabase.from('vehicles').select('id, type, status').eq('id', data.vehicle_id).is('deleted_at', null).single(),
    supabase.from('vehicles').select('id, type, status').eq('id', data.trailer_id).is('deleted_at', null).single(),
    supabase.from('drivers').select('id, status').eq('id', data.driver_id).is('deleted_at', null).single(),
  ])

  if (clientRes.error || !clientRes.data) return { error: 'Cliente no encontrado' }
  if (vehicleRes.error || !vehicleRes.data) return { error: 'Camión no encontrado' }
  if (vehicleRes.data.type !== 'truck') return { error: 'El vehículo seleccionado como camión debe ser tipo camión' }
  if (vehicleRes.data.status !== 'active' && data.vehicle_id !== existing?.vehicle_id) {
    return { error: 'El camión debe estar activo' }
  }
  if (trailerRes.error || !trailerRes.data) return { error: 'Semi/acoplado no encontrado' }
  if (trailerRes.data.type !== 'semi' && trailerRes.data.type !== 'trailer') {
    return { error: 'El semi/acoplado debe ser tipo semi o acoplado' }
  }
  if (trailerRes.data.status !== 'active' && data.trailer_id !== existing?.trailer_id) {
    return { error: 'El semi/acoplado debe estar activo' }
  }
  if (driverRes.error || !driverRes.data) return { error: 'Chofer no encontrado' }
  if (driverRes.data.status !== 'active' && data.driver_id !== existing?.driver_id) {
    return { error: 'El chofer debe estar activo' }
  }

  return null
}

function tripRowFromForm(parsed: {
  client_id: string
  vehicle_id: string
  trailer_id: string
  driver_id: string
  trip_type: string
  origin: string
  destination: string
  number_of_clients: string
  cargo_type: string
  cargo_description?: string
  departure_date?: string
  arrival_date?: string
  total_pallets?: number
  total_packages?: number
  unit_price?: number
  total_kilometers?: number
  km_arcor_system?: number
  km_real_driver?: number
  km_satellite_google?: number
  notes?: string
}) {
  return {
    arcor_client_id: parsed.client_id,
    trip_type: parsed.trip_type,
    vehicle_id: parsed.vehicle_id,
    trailer_id: parsed.trailer_id,
    driver_id: parsed.driver_id,
    origin: parsed.origin,
    destination: parsed.destination,
    number_of_clients: parsed.number_of_clients,
    cargo_type: parsed.cargo_type,
    cargo_description: parsed.cargo_description || null,
    departure_date: parsed.departure_date || null,
    arrival_date: parsed.arrival_date || null,
    total_pallets: parsed.total_pallets ?? null,
    total_packages: parsed.total_packages ?? null,
    unit_price: parsed.unit_price ?? null,
    total_kilometers: parsed.total_kilometers ?? null,
    km_arcor_system: parsed.km_arcor_system ?? null,
    km_real_driver: parsed.km_real_driver ?? null,
    km_satellite_google: parsed.km_satellite_google ?? null,
    notes: parsed.notes || null,
  }
}

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

  const masterError = await validateTripMasters(supabase, parsed.data)
  if (masterError) return masterError

  const code = await nextTripCode(supabase)

  const { data, error } = await supabase
    .from('trips')
    .insert({
      code,
      status: parsed.data.status,
      ...tripRowFromForm(parsed.data),
      metadata: {},
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/app/viajes')
  redirect(`/app/viajes/${data.id}`)
}

export async function updateTrip(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(updateTripSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()
  const tripId = parsed.data.trip_id

  const { data: existing, error: tripError } = await supabase
    .from('trips')
    .select('status, arcor_client_id, vehicle_id, trailer_id, driver_id')
    .eq('id', tripId)
    .is('deleted_at', null)
    .single()

  if (tripError || !existing) return { error: 'Viaje no encontrado' }
  if (existing.status === 'pending_payment' || existing.status === 'paid') {
    return { error: 'No se puede editar un viaje en cobranza' }
  }

  if (parsed.data.client_id !== existing.arcor_client_id) {
    const { count } = await supabase
      .from('proforma_line_items')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId)

    if ((count ?? 0) > 0) {
      return { error: 'No se puede cambiar el cliente: el viaje está en una proforma' }
    }
  }

  const masterError = await validateTripMasters(supabase, parsed.data, existing)
  if (masterError) return masterError

  const { error } = await supabase
    .from('trips')
    .update(tripRowFromForm(parsed.data))
    .eq('id', tripId)

  if (error) return { error: error.message }

  revalidatePath('/app/viajes')
  revalidatePath(`/app/viajes/${tripId}`)
  revalidatePath('/app/dashboard')
  return { success: 'Viaje actualizado' }
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
