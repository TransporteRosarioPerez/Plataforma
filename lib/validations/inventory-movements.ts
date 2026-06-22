import { z } from 'zod'

const baseMovementSchema = z.object({
  item_id: z.string().uuid(),
  movement_type: z.enum(['purchase', 'consumption', 'adjustment']),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  movement_date: z.string().min(1, 'Fecha requerida'),
  notes: z.string().optional(),
})

export const inventoryPurchaseSchema = baseMovementSchema.extend({
  movement_type: z.literal('purchase'),
  unit_cost: z.coerce.number().min(0, 'El costo unitario no puede ser negativo'),
  supplier_name: z.string().optional(),
  invoice_reference: z.string().optional(),
})

export const inventoryConsumptionSchema = baseMovementSchema.extend({
  movement_type: z.literal('consumption'),
})

export const inventoryAdjustmentSchema = baseMovementSchema.extend({
  movement_type: z.literal('adjustment'),
  adjustment_direction: z.enum(['increase', 'decrease']),
  notes: z.string().min(1, 'Indicá el motivo del ajuste'),
})

export const inventoryMovementSchema = z.discriminatedUnion('movement_type', [
  inventoryPurchaseSchema,
  inventoryConsumptionSchema,
  inventoryAdjustmentSchema,
])

export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>
