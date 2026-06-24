import { z } from 'zod'

export const arcorClientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'El nombre es requerido'),
  account_id: z.string().optional(),
  address: z.string().optional(),
})

export type ArcorClientFormData = z.infer<typeof arcorClientSchema>
