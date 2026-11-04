/**
 * Vincula facturas de ARCA con su proforma y decide si se pueden guardar.
 * Lo usa "Facturas → Importar PDFs" (varias facturas a la vez).
 */
import { roundCents } from '@/lib/pdf/numbers'
import { calculateInvoiceAmounts, invoiceIvaTolerance } from '@/lib/invoices/calculate'
import type { ArcaInvoiceParse } from '@/lib/invoices/parse-arca-pdf'

export type BillableProforma = {
  id: string
  proformaNumber: string
  clientId: string | null
  clientName: string
  clientCuit: string | null
  subtotal: number
}

export type InvoiceProformaMatch = {
  /** Proforma elegida sola (si hay una sola que encaja). */
  proformaId: string | null
  /** Proformas pendientes que podrían ser (para elegir a mano si hay más de una). */
  candidateIds: string[]
  /** Cómo se encontró. */
  via: 'numero' | 'neto' | null
  /** El número de proforma del detalle ya está facturado o cobrado. */
  alreadyInvoicedProforma: string | null
}

/** Sólo dígitos: "00002-00000250" y "0000200000250" son la misma factura. */
export function normalizeInvoiceNumber(n: string) {
  return n.replace(/\D/g, '')
}

/**
 * 1) Por el número de proforma del detalle (183853-01-02).
 * 2) Si el detalle no lo trae: por neto exacto y CUIT del cliente.
 */
export function matchInvoiceToProforma(
  inv: Pick<ArcaInvoiceParse, 'neto' | 'clientCuit' | 'proformaNumbers'>,
  billable: BillableProforma[],
  invoicedProformaNumbers: Set<string>
): InvoiceProformaMatch {
  if (inv.proformaNumbers.length > 0) {
    const byNumber = billable.filter((p) => inv.proformaNumbers.includes(p.proformaNumber))
    const alreadyInvoiced = inv.proformaNumbers.find((n) => invoicedProformaNumbers.has(n)) ?? null
    return {
      proformaId: byNumber.length === 1 ? byNumber[0].id : null,
      candidateIds: byNumber.map((p) => p.id),
      via: byNumber.length > 0 ? 'numero' : null,
      alreadyInvoicedProforma: byNumber.length === 0 ? alreadyInvoiced : null,
    }
  }
  if (inv.neto == null) return { proformaId: null, candidateIds: [], via: null, alreadyInvoicedProforma: null }
  const cuit = inv.clientCuit?.replace(/\D/g, '') ?? null
  const byNeto = billable.filter(
    (p) =>
      roundCents(p.subtotal - inv.neto!) === 0 &&
      (!cuit || !p.clientCuit || p.clientCuit.replace(/\D/g, '') === cuit)
  )
  return {
    proformaId: byNeto.length === 1 ? byNeto[0].id : null,
    candidateIds: byNeto.map((p) => p.id),
    via: byNeto.length > 0 ? 'neto' : null,
    alreadyInvoicedProforma: null,
  }
}

export type InvoiceImportStatus = 'ready' | 'problems' | 'existing'

/** Estado de una factura del lote con la proforma elegida. */
export function assessInvoiceImport(
  inv: ArcaInvoiceParse,
  proforma: BillableProforma | null,
  opts: {
    duplicateInvoiceNumber: boolean
    alreadyInvoicedProforma: string | null
    /** Otra factura del mismo lote eligió la misma proforma. */
    proformaTakenByAnother: boolean
  }
): { status: InvoiceImportStatus; problems: string[]; netoDiff: number | null } {
  if (opts.duplicateInvoiceNumber) {
    return { status: 'existing', problems: [`La factura ${inv.invoiceNumber} ya está cargada`], netoDiff: null }
  }
  if (opts.alreadyInvoicedProforma) {
    return {
      status: 'existing',
      problems: [`La proforma ${opts.alreadyInvoicedProforma} ya tiene factura`],
      netoDiff: null,
    }
  }

  const problems = [...inv.errors]
  if (!inv.invoiceType) problems.push('No se pudo leer el tipo de comprobante (A, B o C)')
  if (!inv.issueDate) problems.push('No se pudo leer la fecha de emisión')

  let netoDiff: number | null = null
  if (!proforma) {
    problems.push(
      inv.proformaNumbers.length > 0
        ? `La proforma ${inv.proformaNumbers.join(', ')} no está cargada o no está pendiente`
        : 'No se encontró la proforma: elegila a mano'
    )
  } else {
    if (!proforma.clientId) problems.push('La proforma no tiene cliente')
    if (inv.neto != null) {
      netoDiff = roundCents(inv.neto - proforma.subtotal)
      if (netoDiff !== 0) problems.push('El neto de la factura no coincide con el de la proforma')
      const estimated = calculateInvoiceAmounts(proforma.subtotal)
      if (inv.iva != null && Math.abs(inv.iva - estimated.iva) > invoiceIvaTolerance(inv.lines.length)) {
        problems.push('El IVA de la factura no es el 21% del neto')
      }
    }
    const cuit = inv.clientCuit?.replace(/\D/g, '')
    if (cuit && proforma.clientCuit && proforma.clientCuit.replace(/\D/g, '') !== cuit) {
      problems.push('El CUIT del cliente de la factura no es el de la proforma')
    }
    if (opts.proformaTakenByAnother) problems.push('Otra factura de este lote quedó con la misma proforma')
  }

  return { status: problems.length > 0 ? 'problems' : 'ready', problems, netoDiff }
}
