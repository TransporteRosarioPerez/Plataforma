import { z } from 'zod'

export const createInvoiceSchema = z.object({
  invoice_number: z.string().min(1, 'Número de factura requerido'),
  proforma_id: z.string().uuid('Proforma requerida'),
  invoice_type: z.enum(['A', 'B', 'C']).default('A'),
  issue_date: z.string().min(1, 'Fecha requerida'),
  file_name: z.string().optional(),
  file_url: z.string().optional(),
  /** Importes leídos del PDF de ARCA (mandan sobre el cálculo). */
  pdf_neto: z.coerce.number().optional(),
  pdf_iva: z.coerce.number().optional(),
  pdf_total: z.coerce.number().optional(),
  pdf_lines: z.coerce.number().int().min(0).optional(),
})
