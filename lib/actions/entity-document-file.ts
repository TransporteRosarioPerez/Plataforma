'use server'

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireSession } from '@/lib/auth/session'
import type { ActionState } from '@/lib/validations/parse-form'
import { getSpacesBucket, getSpacesClient } from '@/lib/storage/spaces'
import type { DocumentEntityType } from '@/lib/types'

const URL_EXPIRY_SECONDS = 3600

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

function contentTypeForFileName(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/pdf'
}

function buildStorageKey(
  entityType: DocumentEntityType,
  entityId: string,
  fileName: string
) {
  const safe = sanitizeFileName(fileName)
  return `entity-docs/${entityType}/${entityId}/${Date.now()}-${safe}`
}

export async function generateEntityDocumentUploadUrl(
  entityType: DocumentEntityType,
  entityId: string,
  fileName: string
): Promise<ActionState & { uploadUrl?: string; storageKey?: string; contentType?: string }> {
  await requireSession()

  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { error: 'Formatos permitidos: PDF, JPG o PNG' }
  }

  const storageKey = buildStorageKey(entityType, entityId, fileName)
  const contentType = contentTypeForFileName(fileName)

  try {
    const client = getSpacesClient()
    const bucket = getSpacesBucket()
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: contentType,
    })
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: URL_EXPIRY_SECONDS })
    return { success: 'URL de subida generada', uploadUrl, storageKey, contentType }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al generar URL de subida' }
  }
}

export async function generateEntityDocumentDownloadUrl(
  storageKey: string
): Promise<ActionState & { url?: string }> {
  await requireSession()
  if (!storageKey) return { error: 'Sin archivo asociado' }

  try {
    const client = getSpacesClient()
    const bucket = getSpacesBucket()
    const command = new GetObjectCommand({ Bucket: bucket, Key: storageKey })
    const url = await getSignedUrl(client, command, { expiresIn: URL_EXPIRY_SECONDS })
    return { success: 'URL generada', url }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al generar URL de descarga' }
  }
}
