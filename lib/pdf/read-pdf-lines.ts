'use client'

import { extractPdfLinesOnServer } from '@/lib/actions/pdf-lines'

/** Las server actions de Next aceptan hasta 1 MB; el base64 ocupa ~4/3. */
const SERVER_FALLBACK_MAX_BYTES = 700 * 1024

/** Renglones del PDF: se lee en el navegador y, si falla, en el servidor. */
export async function readPdfLines(file: File): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const { extractPdfLines } = await import('@/lib/pdf/text-lines')
    return await extractPdfLines(bytes.slice())
  } catch (err) {
    if (bytes.length > SERVER_FALLBACK_MAX_BYTES) throw err
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    return extractPdfLinesOnServer(btoa(binary))
  }
}
