import { z } from 'zod'

export const inventoryItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nombre requerido'),
  sku: z.string().optional(),
  category_id: z.string().uuid().optional().or(z.literal('')),
  unit: z.string().min(1, 'Unidad requerida').default('unidad'),
  min_quantity: z.coerce.number().min(0, 'El mínimo no puede ser negativo').default(0),
  notes: z.string().optional(),
  is_active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
})

export const inventoryCategorySchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
})
