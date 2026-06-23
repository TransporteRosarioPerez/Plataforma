'use server'

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import type { ActionState } from '@/lib/validations/parse-form'
import { getSpacesBucket, getSpacesClient } from '@/lib/storage/spaces'

const URL_EXPIRY_SECONDS = 3600

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

function buildStorageKey(clientId: string, fileName: string) {
  const safe = sanitizeFileName(fileName)
  return `facturas/${clientId}/${Date.now()}-${safe}`
}

export async function generateInvoiceUploadUrl(
  clientId: string,
  fileName: string
): Promise<ActionState & { uploadUrl?: string; storageKey?: string; contentType?: string }> {
  await requireSession()

  if (!fileName.toLowerCase().endsWith('.pdf')) {
    return { error: 'Solo se permiten archivos PDF' }
  }

  const storageKey = buildStorageKey(clientId, fileName)

  try {
    const client = getSpacesClient()
    const bucket = getSpacesBucket()
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: 'application/pdf',
    })
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: URL_EXPIRY_SECONDS })
    return { success: 'URL generada', uploadUrl, storageKey, contentType: 'application/pdf' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al generar URL de subida' }
  }
}

export async function generateInvoiceDownloadUrl(
  invoiceId: string
): Promise<ActionState & { url?: string; fileName?: string }> {
  await requireSession()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('file_url, file_name')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single()

  if (error || !data?.file_url) {
    return { error: 'Esta factura no tiene PDF asociado' }
  }

  try {
    const client = getSpacesClient()
    const bucket = getSpacesBucket()
    const command = new GetObjectCommand({ Bucket: bucket, Key: data.file_url })
    const url = await getSignedUrl(client, command, { expiresIn: URL_EXPIRY_SECONDS })
    return {
      success: 'URL generada',
      url,
      fileName: data.file_name ?? 'factura.pdf',
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al generar URL de descarga' }
  }
}
