import { generateProformaUploadUrl } from '@/lib/actions/proforma-file'

export async function appendProformaFileToFormData(
  formData: FormData,
  clientId: string,
  file: File | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!file) return { ok: true }

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, error: 'Solo se permiten archivos PDF' }
  }

  const upload = await generateProformaUploadUrl(clientId, file.name)
  if (upload.error || !upload.uploadUrl || !upload.storageKey) {
    return { ok: false, error: upload.error ?? 'Error al preparar subida' }
  }

  const putRes = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': upload.contentType ?? 'application/pdf' },
    body: file,
  })

  if (!putRes.ok) {
    return { ok: false, error: 'Error al subir el PDF' }
  }

  formData.set('file_url', upload.storageKey)
  formData.set('file_name', file.name)
  return { ok: true }
}
