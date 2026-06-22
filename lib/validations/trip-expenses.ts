import { z } from 'zod'

export const tripExpenseSchema = z.object({
  id: z.string().uuid().optional(),
  trip_id: z.string().uuid(),
  category_id: z.string().uuid('Categoría requerida'),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  paid_by: z.enum(['empresa', 'chofer']),
  description: z.string().optional(),
  expense_date: z.string().min(1, 'Fecha requerida'),
})
