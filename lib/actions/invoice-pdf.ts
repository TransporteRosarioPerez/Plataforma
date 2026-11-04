'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { roundCents } from '@/lib/pdf/numbers'
import {
  matchInvoiceToProforma,
  normalizeInvoiceNumber,
  type BillableProforma,
  type InvoiceProformaMatch,
} from '@/lib/invoices/pdf-import'

export type InvoicePdfMatchInput = {
  invoiceNumber: string | null
  neto: number | null
  clientCuit: string | null
  proformaNumbers: string[]
}

export type InvoicePdfMatchResult =
  | {
      ok: true
      /** Proformas pendientes sin factura (para elegir a mano). */
      billable: BillableProforma[]
      results: (InvoiceProformaMatch & { duplicateInvoiceNumber: boolean })[]
    }
  | { ok: false; error: string }

/** Busca la proforma de cada factura del lote. No guarda nada. */
export async function matchInvoicePdfs(inputs: InvoicePdfMatchInput[]): Promise<InvoicePdfMatchResult> {
  await requireSuperadmin()
  if (inputs.length === 0) return { ok: false, error: 'No hay facturas' }
  if (inputs.length > 100) return { ok: false, error: 'Demasiadas facturas en un solo lote' }
  const supabase = await createClient()

  const [{ data: proformas, error: pError }, { data: invoices, error: iError }, { data: clients, error: cError }] =
    await Promise.all([
      supabase
        .from('proformas')
        .select('id, proforma_number, client_id, client_name, subtotal, status')
        .is('deleted_at', null),
      supabase.from('invoices').select('invoice_number, proforma_id').is('deleted_at', null),
      supabase.from('clients').select('id, cuit').is('deleted_at', null),
    ])
  if (pError || iError || cError) return { ok: false, error: (pError ?? iError ?? cError)!.message }

  const cuitByClient = new Map((clients ?? []).map((c) => [c.id as string, (c.cuit as string | null) ?? null]))
  const invoicedProformaIds = new Set((invoices ?? []).map((i) => i.proforma_id as string))
  const existingNumbers = new Set((invoices ?? []).map((i) => normalizeInvoiceNumber(String(i.invoice_number))))

  const billable: BillableProforma[] = (proformas ?? [])
    .filter((p) => p.status === 'pendiente' && !invoicedProformaIds.has(p.id as string))
    .map((p) => ({
      id: p.id as string,
      proformaNumber: p.proforma_number as string,
      clientId: (p.client_id as string | null) ?? null,
      clientName: p.client_name as string,
      clientCuit: p.client_id ? cuitByClient.get(p.client_id as string) ?? null : null,
      subtotal: roundCents(Number(p.subtotal)),
    }))
  const invoicedNumbers = new Set(
    (proformas ?? [])
      .filter((p) => p.status !== 'pendiente' || invoicedProformaIds.has(p.id as string))
      .map((p) => p.proforma_number as string)
  )

  const results = inputs.map((inv) => ({
    ...matchInvoiceToProforma(inv, billable, invoicedNumbers),
    duplicateInvoiceNumber: !!inv.invoiceNumber && existingNumbers.has(normalizeInvoiceNumber(inv.invoiceNumber)),
  }))

  return { ok: true, billable, results }
}
