import { z } from 'zod'

export const updateTripBillingSchema = z.object({
  trip_id: z.string().uuid(),
  total_income: z.coerce.number().min(0, 'El importe no puede ser negativo'),
  billing_status: z.enum(['pending_payment']).optional(),
})

export const createProformaFromTripSchema = z.object({
  trip_id: z.string().uuid(),
  proforma_number: z.string().min(1, 'Número de proforma requerido'),
  subtotal: z.coerce.number().min(0),
  taxes: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0),
  notes: z.string().optional(),
})
