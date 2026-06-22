import { z } from 'zod'
import { validateIssueBeforeExpiry } from '@/lib/documents/dates'

const renewalFrequencySchema = z.enum([
  'monthly',
  'biannual',
  'yearly',
  'triennial',
  'once',
])

function refineDocumentDates(
  data: { issue_date?: string; expiry_date?: string },
  ctx: z.RefinementCtx
) {
  const message = validateIssueBeforeExpiry(data.issue_date, data.expiry_date)
  if (message) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: ['expiry_date'],
    })
  }
}

export const entityDocumentSchema = z
  .object({
    id: z.string().uuid().optional(),
    entity_id: z.string().uuid(),
    entity_type: z.enum(['vehicle', 'driver', 'company']),
    name: z.string().min(1, 'Nombre requerido').max(120),
    renewal_mode: z.enum(['once', 'interval']),
    renewal_frequency: renewalFrequencySchema.optional(),
    expiry_date: z.string().optional(),
    issue_date: z.string().optional(),
    file_name: z.string().optional(),
    file_url: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.renewal_mode === 'interval') {
      if (!data.renewal_frequency || data.renewal_frequency === 'once') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Indicá cada cuánto se renueva',
          path: ['renewal_frequency'],
        })
      }
      if (!data.expiry_date?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Vencimiento requerido para documentos por intervalo',
          path: ['expiry_date'],
        })
      }
    }
    refineDocumentDates(data, ctx)
  })

export const renewEntityDocumentSchema = z
  .object({
    id: z.string().uuid(),
    entity_id: z.string().uuid(),
    entity_type: z.enum(['vehicle', 'driver', 'company']),
    expiry_date: z.string().min(1, 'Vencimiento requerido'),
    issue_date: z.string().optional(),
    file_name: z.string().optional(),
    file_url: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine(refineDocumentDates)

export const alertSettingsSchema = z.object({
  id: z.string().uuid(),
  alert_enabled: z.enum(['true', 'false']),
  alert_whatsapp_phones: z.string().optional(),
  alert_days_before: z.coerce.number().min(1).max(90).optional(),
})
