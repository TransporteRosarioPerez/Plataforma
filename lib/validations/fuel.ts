import { z } from 'zod'

const optionalNumber = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : v),
  z.coerce.number().nonnegative().optional()
)

export const fuelLoadSchema = z.object({
  id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid('Elegí la patente'),
  driver_id: z.string().uuid().optional().or(z.literal('')),
  load_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha requerida'),
  liters: z.coerce.number().positive('Los litros deben ser mayores a 0'),
  /** Total pagado. Vacío o 0 = precio pendiente. */
  amount_total: optionalNumber,
  odometer_km: optionalNumber,
  payment_method: z.enum(['cuenta_corriente', 'contado', 'tarjeta', 'otro']).optional().or(z.literal('')),
  station_name: z.string().trim().optional(),
  ticket_number: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

export type FuelLoadInput = z.infer<typeof fuelLoadSchema>
