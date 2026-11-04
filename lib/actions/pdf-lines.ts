'use server'

import { requireSession } from '@/lib/auth/session'
import { extractPdfLines } from '@/lib/pdf/text-lines'

/** Plan B si el navegador no puede leer el PDF: se lee en el servidor (límite ~1 MB de Next). */
export async function extractPdfLinesOnServer(base64: string): Promise<string[][]> {
  await requireSession()
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length === 0 || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error('El archivo no es un PDF válido')
  }
  return extractPdfLines(new Uint8Array(bytes))
}
