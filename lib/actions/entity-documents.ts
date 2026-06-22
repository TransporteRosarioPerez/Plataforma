'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { parseForm, type ActionState } from '@/lib/validations/parse-form'
import {
  entityDocumentSchema,
  renewEntityDocumentSchema,
} from '@/lib/validations/entity-documents'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { computeDocumentStatus } from '@/lib/documents/status'
import { isRenewableFrequency } from '@/lib/documents/renewal'
import type { RenewalFrequency } from '@/lib/types'

function revalidateEntityPaths(entityType: string, entityId: string) {
  revalidatePath('/app/documentos')
  revalidatePath('/app/dashboard')
  if (entityType === 'vehicle') {
    revalidatePath('/app/flota')
    revalidatePath(`/app/flota/${entityId}`)
  }
  if (entityType === 'driver') {
    revalidatePath('/app/choferes')
    revalidatePath(`/app/choferes/${entityId}`)
  }
  if (entityType === 'company') {
    revalidatePath('/app/configuracion/empresa')
  }
}

async function getAlertDaysBefore(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from('company_settings')
    .select('alert_days_before')
    .limit(1)
    .maybeSingle()
  return data?.alert_days_before ?? 7
}

function resolveRenewalFrequency(parsed: {
  renewal_mode: 'once' | 'interval'
  renewal_frequency?: RenewalFrequency
}): RenewalFrequency {
  if (parsed.renewal_mode === 'once') return 'once'
  return parsed.renewal_frequency ?? 'once'
}

function buildDocumentRow(
  parsed: {
    entity_id: string
    entity_type: 'vehicle' | 'driver' | 'company'
    name: string
    expiry_date?: string
    issue_date?: string
    file_name?: string
    file_url?: string
    notes?: string
  },
  renewalFrequency: RenewalFrequency,
  documentGroupId: string,
  alertDays: number
) {
  const expiryDate =
    renewalFrequency === 'once' ? null : parsed.expiry_date?.trim() || null
  const status =
    renewalFrequency === 'once' && !expiryDate
      ? 'valid'
      : computeDocumentStatus(expiryDate ? new Date(expiryDate) : null, alertDays)

  return {
    name: parsed.name.trim(),
    renewal_frequency: renewalFrequency,
    document_group_id: documentGroupId,
    entity_id: parsed.entity_id,
    entity_type: parsed.entity_type,
    file_name: parsed.file_name || null,
    file_url: parsed.file_url || null,
    issue_date: parsed.issue_date || null,
    expiry_date: expiryDate,
    status,
    notes: parsed.notes || null,
    is_current: true,
    superseded_at: null,
    uploaded_at: parsed.file_url ? new Date().toISOString() : null,
  }
}

export async function upsertEntityDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(entityDocumentSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()
  const alertDays = await getAlertDaysBefore(supabase)
  const renewalFrequency = resolveRenewalFrequency(parsed.data)

  if (parsed.data.id) {
    const { data: existing } = await supabase
      .from('entity_documents')
      .select('id, is_current, renewal_frequency')
      .eq('id', parsed.data.id)
      .single()

    if (!existing?.is_current) {
      return { error: 'Solo se puede editar el documento vigente' }
    }

    if (isRenewableFrequency(existing.renewal_frequency as RenewalFrequency)) {
      return {
        error: 'Los documentos por intervalo se actualizan con "Renovar" para guardar el historial',
      }
    }

    const updatePayload: Record<string, unknown> = {
      name: parsed.data.name.trim(),
      issue_date: parsed.data.issue_date || null,
      expiry_date: null,
      status: 'valid',
      notes: parsed.data.notes || null,
    }

    if (parsed.data.file_url) {
      updatePayload.file_url = parsed.data.file_url
      updatePayload.file_name = parsed.data.file_name || null
      updatePayload.uploaded_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('entity_documents')
      .update(updatePayload)
      .eq('id', parsed.data.id)
    if (error) return { error: error.message }
  } else {
    const groupId = crypto.randomUUID()
    const row = buildDocumentRow(parsed.data, renewalFrequency, groupId, alertDays)
    const { error } = await supabase.from('entity_documents').insert(row)
    if (error) return { error: error.message }
  }

  revalidateEntityPaths(parsed.data.entity_type, parsed.data.entity_id)
  return { success: parsed.data.id ? 'Documento actualizado' : 'Documento registrado' }
}

export async function renewEntityDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const parsed = parseForm(renewEntityDocumentSchema, formData)
  if (!parsed.success) return { error: parsed.error }

  const supabase = await createClient()
  const alertDays = await getAlertDaysBefore(supabase)

  const { data: current, error: fetchError } = await supabase
    .from('entity_documents')
    .select('id, document_group_id, name, renewal_frequency, is_current')
    .eq('id', parsed.data.id)
    .single()

  if (fetchError || !current) return { error: 'Documento no encontrado' }
  if (!current.is_current) return { error: 'Solo se puede renovar el documento vigente' }

  const frequency = current.renewal_frequency as RenewalFrequency
  if (!isRenewableFrequency(frequency)) {
    return { error: 'Este documento es único y no se renueva por intervalo' }
  }

  const now = new Date().toISOString()

  const { error: archiveError } = await supabase
    .from('entity_documents')
    .update({ is_current: false, superseded_at: now })
    .eq('id', current.id)

  if (archiveError) return { error: archiveError.message }

  const row = buildDocumentRow(
    { ...parsed.data, name: current.name as string },
    frequency,
    current.document_group_id as string,
    alertDays
  )

  const { error: insertError } = await supabase.from('entity_documents').insert(row)
  if (insertError) return { error: insertError.message }

  revalidateEntityPaths(parsed.data.entity_type, parsed.data.entity_id)
  return { success: 'Renovación registrada. La versión anterior quedó en el historial.' }
}

export async function deleteEntityDocument(
  id: string,
  entityType: string,
  entityId: string
): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('entity_documents')
    .select('is_current')
    .eq('id', id)
    .single()

  if (!doc?.is_current) {
    return { error: 'Solo se puede eliminar el documento vigente' }
  }

  const { error } = await supabase
    .from('entity_documents')
    .update(softDeleteUpdate())
    .eq('id', id)
    .is('deleted_at', null)
  if (error) return { error: error.message }

  revalidateEntityPaths(entityType, entityId)
  revalidatePath('/app/papelera')
  return { success: 'Documento dado de baja. Podés recuperarlo desde Papelera.' }
}
