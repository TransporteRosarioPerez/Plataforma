import type { z } from 'zod'

export type ActionState = {
  error?: string
  success?: string
}

export function formDataToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {}
  formData.forEach((value, key) => {
    if (typeof value === 'string') obj[key] = value
  })
  return obj
}

export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const raw = formDataToObject(formData)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { success: false, error: first?.message ?? 'Datos inválidos' }
  }
  return { success: true, data: parsed.data }
}
