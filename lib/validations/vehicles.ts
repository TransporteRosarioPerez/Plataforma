import { z } from 'zod'

export const vehicleSchema = z.object({
  id: z.string().uuid().optional(),
  plate: z.string().min(1, 'La patente es requerida'),
  brand: z.string().min(1, 'La marca es requerida'),
  model: z.string().min(1, 'El modelo es requerido'),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  type: z.enum(['truck', 'semi', 'trailer']),
  status: z.enum(['active', 'maintenance', 'inactive']),
})

export type VehicleFormData = z.infer<typeof vehicleSchema>
