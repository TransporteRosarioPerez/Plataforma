export const INVOICE_IVA_RATE = 0.21

export function calculateInvoiceAmounts(neto: number) {
  const iva = Math.round(neto * INVOICE_IVA_RATE * 100) / 100
  return {
    subtotal: neto,
    iva,
    total: Math.round((neto + iva) * 100) / 100,
  }
}
