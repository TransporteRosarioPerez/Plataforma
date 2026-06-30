import { z } from 'zod'
import { CARGO_TYPES, TRIP_STATUSES, type CargoType } from '@/lib/types'

const cargoTypeSchema = z.enum(CARGO_TYPES as [CargoType, ...CargoType[]])

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    schema.optional()
  )

const tripStatusSchema = z.enum([
  'in_progress',
  'delivered',
  'incomplete',
  'pending_wirtrack',
  'sent',
  'pending_payment',
  'paid',
])

export const createTripSchema = z.object({
  client_id: z.string().uuid('Seleccioná un cliente'),
  vehicle_id: z.string().uuid('Seleccioná un camión'),
  trailer_id: z.string().uuid('Seleccioná un semi o acoplado'),
  driver_id: z.string().uuid('Seleccioná un chofer'),
  trip_type: z.enum(['carta_porte', 'solo_remitos']),
  origin: z.string().min(1, 'El origen es obligatorio'),
  destination: z.string().min(1, 'El destino es obligatorio'),
  number_of_clients: z.string().min(1, 'Cantidad de clientes requerida'),
  cargo_type: cargoTypeSchema,
  status: tripStatusSchema.default('incomplete'),
  departure_date: z.string().optional(),
  arrival_date: z.string().optional(),
  total_pallets: optionalNumber(z.coerce.number().int().min(1)),
  total_packages: optionalNumber(z.coerce.number().int().min(1)),
  unit_price: optionalNumber(z.coerce.number().min(0)),
  total_kilometers: z.coerce.number().optional(),
  km_arcor_system: z.coerce.number().optional(),
  km_real_driver: z.coerce.number().optional(),
  km_satellite_google: z.coerce.number().optional(),
  cargo_description: z.string().optional(),
  notes: z.string().optional(),
})

export const updateTripStatusSchema = z.object({
  status: tripStatusSchema,
})

export const updateTripEstimateSchema = z.object({
  trip_id: z.string().uuid(),
  unit_price: optionalNumber(z.coerce.number().min(0)),
  total_pallets: optionalNumber(z.coerce.number().int().min(1)),
})

export const updateTripSchema = createTripSchema
  .omit({ status: true })
  .extend({
    trip_id: z.string().uuid(),
  })

export type CreateTripFormData = z.infer<typeof createTripSchema>

export { TRIP_STATUSES, tripStatusSchema }
