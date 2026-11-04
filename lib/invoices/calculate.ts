import { roundCents } from '@/lib/pdf/numbers'

export const INVOICE_IVA_RATE = 0.21

/**
 * Estimación de IVA y total sobre el neto completo.
 *
 * OJO: ARCA calcula el IVA línea por línea y redondea cada una, así que la
 * factura real puede diferir en algunos centavos. Cuando hay PDF de la factura
 * se guardan los importes impresos (ver parse-arca-pdf); esto queda como
 * estimación cuando no hay PDF.
 */
export function calculateInvoiceAmounts(neto: number) {
  const subtotal = roundCents(neto)
  const iva = roundCents(subtotal * INVOICE_IVA_RATE)
  return {
    subtotal,
    iva,
    total: roundCents(subtotal + iva),
  }
}

/** Diferencia de IVA aceptable por redondeo: hasta 1 centavo por línea de la factura. */
export function invoiceIvaTolerance(lineCount: number) {
  return roundCents(0.01 * Math.max(1, lineCount)) + 0.0001
}
