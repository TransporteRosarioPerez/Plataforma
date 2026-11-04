/**
 * Texto de un PDF agrupado en renglones, página por página.
 *
 * Los PDF no tienen "renglones": cada palabra o celda es un ítem suelto con su
 * posición. Para leer tablas (proformas de Arcor, facturas de ARCA) los
 * juntamos por altura (y) y los ordenamos de izquierda a derecha (x).
 *
 * Sirve en el navegador y en el servidor (unpdf trae su propio pdf.js).
 */

export type PdfTextItem = { str: string; x: number; y: number }

/** Dos ítems están en el mismo renglón si su altura difiere a lo sumo esto. */
const SAME_LINE_TOLERANCE = 2

export function groupTextItemsIntoLines(
  items: PdfTextItem[],
  tolerance = SAME_LINE_TOLERANCE
): string[] {
  const sorted = items
    .map((it) => ({ ...it, str: it.str.trim() }))
    .filter((it) => it.str !== '')
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const rows: { y: number; items: PdfTextItem[] }[] = []
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= tolerance)
    if (row) row.items.push(item)
    else rows.push({ y: item.y, items: [item] })
  }

  return rows.map((row) =>
    row.items
      .sort((a, b) => a.x - b.x)
      .map((it) => it.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** Renglones de cada página del PDF. */
export async function extractPdfLines(data: Uint8Array): Promise<string[][]> {
  const { extractTextItems, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(data)
  const { items } = await extractTextItems(pdf)
  return items.map((pageItems) =>
    groupTextItemsIntoLines(pageItems.map((it) => ({ str: it.str, x: it.x, y: it.y })))
  )
}
