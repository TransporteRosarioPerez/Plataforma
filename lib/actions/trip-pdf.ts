'use server'

import { revalidatePath } from 'next/cache'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import type { ActionState } from '@/lib/validations/parse-form'
import { getSpacesBucket, getSpacesClient } from '@/lib/storage/spaces'

const URL_EXPIRY_SECONDS = 3600

async function getTripStorageKey(tripId: string): Promise<{ key: string | null; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trips')
    .select('pdf_storage_key')
    .eq('id', tripId)
    .single()

  if (error || !data) return { key: null, error: 'Viaje no encontrado' }
  return { key: data.pdf_storage_key }
}

export async function generateTripPdfDownloadUrl(tripId: string): Promise<ActionState & { url?: string }> {
  await requireSession()
  const { key, error } = await getTripStorageKey(tripId)
  if (error) return { error }
  if (!key) return { error: 'Este viaje no tiene PDF asociado' }

  try {
    const client = getSpacesClient()
    const bucket = getSpacesBucket()
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await getSignedUrl(client, command, { expiresIn: URL_EXPIRY_SECONDS })
    return { success: 'URL generada', url }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al generar URL de descarga' }
  }
}

export async function generateTripPdfUploadUrl(
  tripId: string,
  fileName: string
): Promise<ActionState & { uploadUrl?: string; storageKey?: string }> {
  await requireSession()
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    return { error: 'Solo se permiten archivos PDF' }
  }

  const supabase = await createClient()
  const { data: trip, error } = await supabase.from('trips').select('code').eq('id', tripId).single()
  if (error || !trip) return { error: 'Viaje no encontrado' }

  const storageKey = fileName

  try {
    const client = getSpacesClient()
    const bucket = getSpacesBucket()
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: 'application/pdf',
    })
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: URL_EXPIRY_SECONDS })
    return { success: 'URL de subida generada', uploadUrl, storageKey }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al generar URL de subida' }
  }
}

export async function registerTripPdf(tripId: string, storageKey: string): Promise<ActionState> {
  const session = await requireSession()
  const supabase = await createClient()
  const fileName = storageKey.split('/').pop() ?? storageKey

  const { error: tripError } = await supabase
    .from('trips')
    .update({ pdf_storage_key: storageKey, pdf_uploaded_by: session.profile.id })
    .eq('id', tripId)

  if (tripError) return { error: tripError.message }

  const { data: existing } = await supabase
    .from('trip_documents')
    .select('id')
    .eq('trip_id', tripId)
    .eq('document_type', 'trip_pdf')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('trip_documents')
      .update({
        file_name: fileName,
        file_url: storageKey,
        storage_path: storageKey,
        uploaded_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('trip_documents').insert({
      trip_id: tripId,
      document_type: 'trip_pdf',
      file_name: fileName,
      file_url: storageKey,
      storage_path: storageKey,
      status: 'ok',
      metadata: {},
    })
    if (error) return { error: error.message }
  }

  revalidatePath(`/app/viajes/${tripId}`)
  return { success: 'PDF registrado' }
}

/** Nombre sugerido al subir: {code}-{año}-{mes}-{día}.pdf (mes sin cero). */
export async function suggestTripPdfFileName(tripId: string): Promise<ActionState & { fileName?: string }> {
  await requireSession()
  const supabase = await createClient()
  const { data, error } = await supabase.from('trips').select('code').eq('id', tripId).single()
  if (error || !data) return { error: 'Viaje no encontrado' }
  const now = new Date()
  const fileName = `${data.code}-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}.pdf`
  return { success: 'ok', fileName }
}
