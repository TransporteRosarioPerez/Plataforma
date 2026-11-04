/**
 * Arma un PDF nuevo con algunas páginas de otro (para que cada proforma
 * guarde sólo sus hojas). Requiere `pdf-lib`.
 */
export async function extractPdfPages(
  source: Uint8Array,
  pages: number[],
  fileName: string
): Promise<File> {
  const { PDFDocument } = await import('pdf-lib')
  const src = await PDFDocument.load(source, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const indices = pages.map((p) => p - 1).filter((i) => i >= 0 && i < src.getPageCount())
  if (indices.length === 0) throw new Error('No hay páginas para extraer')
  const copied = await out.copyPages(src, indices)
  for (const page of copied) out.addPage(page)
  const bytes = await out.save()
  return new File([bytes as BlobPart], fileName, { type: 'application/pdf' })
}

/** "PEREZ-1-9.pdf" → nombre para una proforma: "183853-01-02 (hojas 1-9).pdf" */
export function proformaPdfFileName(proformaNumber: string, pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b)
  const contiguous = sorted.every((p, i) => i === 0 || p === sorted[i - 1] + 1)
  const label =
    sorted.length === 1
      ? `hoja ${sorted[0]}`
      : contiguous
        ? `hojas ${sorted[0]}-${sorted[sorted.length - 1]}`
        : `hojas ${sorted.join(',')}`
  return `${proformaNumber} (${label}).pdf`
}
