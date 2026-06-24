'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { softDeleteUpdate } from '@/lib/db/soft-delete'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import type { ActionState } from '@/lib/validations/parse-form'

export async function addTripDocumentMetadata(
  tripId: string,
  formData: FormData
): Promise<ActionState> {
  await requireSession()
  const documentType = formData.get('document_type')?.toString()
  const fileName = formData.get('file_name')?.toString() || 'documento.pdf'
  const documentNumber = formData.get('document_number')?.toString()

  if (!documentType) return { error: 'Tipo de documento requerido' }

  const supabase = await createClient()
  const { error } = await supabase.from('trip_documents').insert({
    trip_id: tripId,
    document_type: documentType,
    document_number: documentNumber || null,
    file_name: fileName,
    file_url: formData.get('file_url')?.toString() || '/placeholder',
    status: 'ok',
    metadata: {},
  })

  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.tripDocumentAdd,
    entityType: 'trip',
    entityId: tripId,
    summary: `Registró documento ${documentType} en un viaje`,
    metadata: { documentType, fileName },
  })

  revalidatePath(`/app/viajes/${tripId}`)
  return { success: 'Documento registrado' }
}

export async function deleteTripDocument(
  tripId: string,
  documentId: string
): Promise<ActionState> {
  await requireSession()
  const supabase = await createClient()
  const { error } = await supabase
    .from('trip_documents')
    .update(softDeleteUpdate())
    .eq('id', documentId)
    .is('deleted_at', null)
  if (error) return { error: error.message }

  await logAudit({
    action: AUDIT_ACTIONS.tripDocumentDelete,
    entityType: 'trip_document',
    entityId: documentId,
    summary: 'Eliminó un documento de viaje',
    metadata: { tripId },
  })

  revalidatePath(`/app/viajes/${tripId}`)
  revalidatePath('/app/papelera')
  return { success: 'Documento dado de baja. Podés recuperarlo desde Papelera.' }
}
