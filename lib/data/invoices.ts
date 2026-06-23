import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSession, requireSuperadmin } from '@/lib/auth/session'
import { canAccessInvoices } from '@/lib/auth/permissions'
import { mapInvoice, type DbInvoice } from '@/lib/db/mappers'

export const getInvoices = cache(async () => {
  await requireSuperadmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as DbInvoice[]).map(mapInvoice)
})

export const getInvoiceById = cache(async (id: string) => {
  const session = await getSession()
  if (!session || !canAccessInvoices(session.profile.role)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return mapInvoice(data as DbInvoice)
})

export const getInvoiceByProformaId = cache(async (proformaId: string) => {
  const session = await getSession()
  if (!session || !canAccessInvoices(session.profile.role)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('proforma_id', proformaId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapInvoice(data as DbInvoice) : null
})

export const getInvoicesByTripId = cache(async (tripId: string) => {
  const session = await getSession()
  if (!session || !canAccessInvoices(session.profile.role)) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .contains('trip_ids', [tripId])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as DbInvoice[]).map(mapInvoice)
})

export const getInvoicesByProformaIds = cache(async (proformaIds: string[]) => {
  if (proformaIds.length === 0) return {} as Record<string, ReturnType<typeof mapInvoice>>

  const session = await getSession()
  if (!session || !canAccessInvoices(session.profile.role)) {
    return {} as Record<string, ReturnType<typeof mapInvoice>>
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .in('proforma_id', proformaIds)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const byProformaId: Record<string, ReturnType<typeof mapInvoice>> = {}
  for (const row of (data ?? []) as DbInvoice[]) {
    if (row.proforma_id) byProformaId[row.proforma_id] = mapInvoice(row)
  }
  return byProformaId
})
