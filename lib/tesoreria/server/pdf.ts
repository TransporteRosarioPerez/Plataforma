import 'server-only'
import { extractText, getDocumentProxy } from 'unpdf'

export const MAX_PDF_BYTES = 5 * 1024 * 1024

/** Texto plano de un PDF (todas las páginas, en orden de lectura). */
export async function extractPdfText(base64: string): Promise<string> {
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length === 0) throw new Error('El PDF está vacío')
  if (bytes.length > MAX_PDF_BYTES) throw new Error('El PDF es demasiado grande (máximo 5 MB)')
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('El archivo no es un PDF válido')
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const { text } = await extractText(pdf, { mergePages: true })
  return text
}
