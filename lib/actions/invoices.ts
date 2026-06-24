'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import { createInvoiceSchema } from '@/lib/validations/invoices'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { calculateInvoiceAmounts } from '@/lib/invoices/calculate'
import { applyProformaLineItemsToTrips, loadProformaLineAmounts } from '@/lib/proformas/trip-billing-sync'

function revalidateInvoicePaths(proformaId?: string, tripIds: string[] = []) {
  revalidatePath('/app/facturas')
  revalidatePath('/app/proformas')
  revalidatePath('/app/viajes')
  revalidatePath('/app/papelera')
  revalidatePath('/app/reportes')
  if (proformaId) revalidatePath(`/app/proformas`)
  for (const tripId of tripIds) {
    revalidatePath(`/app/viajes/${tripId}`)
  }
}

export async function createInvoice(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin()
  const parsed = parseForm(createInvoiceSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()

  const { data: proforma, error: proformaError } = await supabase
    .from('proformas')
    .select('id, status, client_id, client_name, trip_ids, subtotal')
    .eq('id', parsed.data.proforma_id)
    .is('deleted_at', null)
    .single()

  if (proformaError || !proforma) return { error: 'Proforma no encontrada' }
  if (proforma.status !== 'pendiente') {
    return { error: 'Solo se puede facturar una proforma en estado Pendiente' }
  }

  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('proforma_id', parsed.data.proforma_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingInvoice) {
    return { error: 'Esta proforma ya tiene una factura vinculada' }
  }

  const neto = Number(proforma.subtotal)
  if (neto <= 0) return { error: 'La proforma no tiene importe neto' }

  const amounts = calculateInvoiceAmounts(neto)
  const tripIds: string[] = proforma.trip_ids ?? []

  const { data: client } = proforma.client_id
    ? await supabase.from('clients').select('cuit').eq('id', proforma.client_id).maybeSingle()
    : { data: null }

  const { data: insertedInvoice, error: insertError } = await supabase.from('invoices').insert({
    invoice_number: parsed.data.invoice_number,
    invoice_type: parsed.data.invoice_type,
    client_id: proforma.client_id,
    client_name: proforma.client_name,
    client_cuit: client?.cuit ?? null,
    proforma_id: proforma.id,
    trip_ids: tripIds,
    subtotal: amounts.subtotal,
    iva: amounts.iva,
    total: amounts.total,
    status: 'emitida',
    issue_date: parsed.data.issue_date,
    file_name: parsed.data.file_name || null,
    file_url: parsed.data.file_url || null,
  }).select('id').single()

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'Ya existe una factura con ese número o proforma vinculada' }
    }
    return { error: insertError.message }
  }

  const { error: updateProformaError } = await supabase
    .from('proformas')
    .update({ status: 'facturada' })
    .eq('id', proforma.id)

  if (updateProformaError) return { error: updateProformaError.message }

  await logAudit({
    action: AUDIT_ACTIONS.invoiceCreate,
    entityType: 'invoice',
    entityId: insertedInvoice.id,
    entityLabel: parsed.data.invoice_number,
    summary: `Creó la factura ${parsed.data.invoice_number}`,
    metadata: { proformaId: proforma.id },
  })

  revalidateInvoicePaths(proforma.id, tripIds)
  return { success: 'Factura creada' }
}

export async function markInvoicePaid(invoiceId: string): Promise<ActionState> {
  await requireSuperadmin()
  const supabase = await createClient()

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, status, proforma_id, trip_ids, invoice_number')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !invoice) return { error: 'Factura no encontrada' }
  if (invoice.status === 'cobrada') return { error: 'La factura ya está cobrada' }
  if (invoice.status === 'anulada') return { error: 'No se puede cobrar una factura anulada' }
  if (!invoice.proforma_id) return { error: 'Factura sin proforma vinculada' }

  const { error: invoiceError } = await supabase
    .from('invoices')
    .update({ status: 'cobrada', paid_date: new Date().toISOString().slice(0, 10) })
    .eq('id', invoiceId)

  if (invoiceError) return { error: invoiceError.message }

  const { error: proformaError } = await supabase
    .from('proformas')
    .update({ status: 'cobrada' })
    .eq('id', invoice.proforma_id)

  if (proformaError) return { error: proformaError.message }

  const lineItems = await loadProformaLineAmounts(supabase, invoice.proforma_id)
  await applyProformaLineItemsToTrips(supabase, lineItems, 'paid')

  await logAudit({
    action: AUDIT_ACTIONS.invoiceMarkPaid,
    entityType: 'invoice',
    entityId: invoiceId,
    entityLabel: invoice.invoice_number,
    summary: `Marcó como cobrada la factura ${invoice.invoice_number}`,
  })

  const tripIds: string[] = invoice.trip_ids ?? []
  revalidateInvoicePaths(invoice.proforma_id, tripIds)
  return { success: 'Factura marcada como cobrada' }
}

export async function deleteInvoice(id: string): Promise<ActionState> {
  await requireSuperadmin()
  const supabase = await createClient()

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, status, proforma_id, trip_ids, invoice_number')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !invoice) return { error: 'Factura no encontrada' }
  if (invoice.status === 'cobrada') {
    return { error: 'No se puede dar de baja una factura ya cobrada' }
  }

  const { error } = await supabase
    .from('invoices')
    .update(softDeleteUpdate())
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  if (invoice.proforma_id) {
    await supabase
      .from('proformas')
      .update({ status: 'pendiente' })
      .eq('id', invoice.proforma_id)
      .eq('status', 'facturada')
  }

  await logAudit({
    action: AUDIT_ACTIONS.invoiceDelete,
    entityType: 'invoice',
    entityId: id,
    entityLabel: invoice.invoice_number,
    summary: `Eliminó la factura ${invoice.invoice_number}`,
  })

  const tripIds: string[] = invoice.trip_ids ?? []
  revalidateInvoicePaths(invoice.proforma_id ?? undefined, tripIds)
  return { success: 'Factura dada de baja. Podés recuperarla desde Papelera.' }
}
