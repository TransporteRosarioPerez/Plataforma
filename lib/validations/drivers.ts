import { z } from 'zod'

export const driverSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'El nombre es requerido'),
  dni: z.string().min(7, 'DNI inválido'),
  license_number: z.string().optional(),
  license_expiry: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']),
})

export type DriverFormData = z.infer<typeof driverSchema>
