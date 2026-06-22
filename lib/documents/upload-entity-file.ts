import { generateEntityDocumentUploadUrl } from '@/lib/actions/entity-document-file'
import type { DocumentEntityType } from '@/lib/types'

export async function appendUploadedFileToFormData(
  formData: FormData,
  entityType: DocumentEntityType,
  entityId: string,
  file: File | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!file) return { ok: true }

  const upload = await generateEntityDocumentUploadUrl(entityType, entityId, file.name)
  if (upload.error || !upload.uploadUrl || !upload.storageKey) {
    return { ok: false, error: upload.error ?? 'Error al preparar subida' }
  }

  const putRes = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': upload.contentType ?? 'application/octet-stream' },
    body: file,
  })

  if (!putRes.ok) {
    return { ok: false, error: 'Error al subir el archivo' }
  }

  formData.set('file_url', upload.storageKey)
  formData.set('file_name', file.name)
  return { ok: true }
}
