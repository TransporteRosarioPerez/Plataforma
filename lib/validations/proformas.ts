import { z } from 'zod'

export const createProformaSchema = z.object({
  proforma_number: z.string().min(1, 'Número de proforma requerido'),
  client_id: z.string().uuid('Cliente requerido'),
  line_items: z.string().min(2, 'Seleccioná al menos un viaje'),
  received_date: z.string().min(1),
  notes: z.string().optional(),
  file_name: z.string().optional(),
  file_url: z.string().optional(),
})

export const updateProformaSchema = z.object({
  id: z.string().uuid(),
  proforma_number: z.string().min(1, 'Número de proforma requerido'),
  subtotal: z.coerce.number().min(0),
  taxes: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
  status: z.enum(['pendiente', 'facturada', 'cobrada']),
  received_date: z.string().min(1),
  notes: z.string().optional(),
  file_name: z.string().optional(),
  file_url: z.string().optional(),
})
