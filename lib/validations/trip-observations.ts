import { z } from 'zod'

export const tripObservationSchema = z.object({
  id: z.string().uuid().optional(),
  trip_id: z.string().uuid(),
  content: z
    .string()
    .trim()
    .min(1, 'Escribí la observación')
    .max(5000, 'La observación es demasiado larga'),
})
