import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { INVENTORY_ENABLED } from '@/lib/features'

export type DashboardStats = {
  clientsCount: number
  vehiclesCount: number
  driversCount: number
  tripsCount: number
  sentTripsCount: number
  expiringDocuments: number
  pendingProformas: number
  pendingAmount: number
  lowStockItems: number
}

export type DashboardSentTrip = {
  id: string
  code: string
  clientName: string
  accountId?: string
  origin: string
  destination?: string
  departureDate?: Date
  totalIncome: number
}

export const getDashboardStats = cache(async (): Promise<DashboardStats> => {
  const supabase = await createClient()

  const [clients, vehicles, drivers, trips, sentTrips, expiring, proformas, inventoryItems] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('vehicles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('drivers').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('trips').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .is('deleted_at', null),
    supabase
      .from('entity_documents')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('is_current', true)
      .in('status', ['expiring_soon', 'expired']),
    supabase
      .from('proformas')
      .select('total, status')
      .is('deleted_at', null)
      .eq('status', 'pendiente'),
    INVENTORY_ENABLED
      ? supabase
          .from('inventory_items')
          .select('current_quantity, min_quantity, is_active')
          .is('deleted_at', null)
      : Promise.resolve({ data: null, error: null }),
  ])

  const pendingAmount =
    proformas.data?.reduce((sum, row) => sum + Number(row.total ?? 0), 0) ?? 0

  const lowStockItems = INVENTORY_ENABLED
    ? inventoryItems.data?.filter(
        (row) =>
          row.is_active &&
          Number(row.current_quantity) <= Number(row.min_quantity)
      ).length ?? 0
    : 0

  return {
    clientsCount: clients.count ?? 0,
    vehiclesCount: vehicles.count ?? 0,
    driversCount: drivers.count ?? 0,
    tripsCount: trips.count ?? 0,
    sentTripsCount: sentTrips.count ?? 0,
    expiringDocuments: expiring.count ?? 0,
    pendingProformas: proformas.data?.length ?? 0,
    pendingAmount,
    lowStockItems,
  }
})

export const getSentTripsForDashboard = cache(async (limit = 10): Promise<DashboardSentTrip[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trips')
    .select(`
      id,
      code,
      origin,
      destination,
      departure_date,
      total_income,
      arcor_clients:arcor_clients!trips_arcor_client_id_fkey (name, account_id)
    `)
    .eq('status', 'sent')
    .is('deleted_at', null)
    .order('departure_date', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const clientRaw = row.arcor_clients
    const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw
    const typedClient = client as { name: string; account_id: string | null } | null | undefined
    return {
      id: row.id as string,
      code: row.code as string,
      clientName: typedClient?.name ?? '—',
      accountId: typedClient?.account_id ?? undefined,
      origin: (row.origin as string) ?? '',
      destination: (row.destination as string) ?? undefined,
      departureDate: row.departure_date ? new Date(row.departure_date as string) : undefined,
      totalIncome: Number(row.total_income ?? 0),
    }
  })
})
