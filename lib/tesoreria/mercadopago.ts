import type { SheetCell } from './types'
import { parseAmountCell } from './text'

/**
 * Mercado Pago sólo permite bajar el "Resumen de cuenta" en PDF.
 * Del PDF se extrae el texto (en el servidor) y acá se convierte en las mismas
 * celdas que daría una planilla, para reutilizar el pipeline de importación.
 *
 * Cada movimiento en el texto tiene la forma (la descripción puede ocupar varias líneas):
 *   dd-mm-yyyy  <descripción>  <ID de la operación>  $ <valor>  $ <saldo>
 */

export const MERCADOPAGO_HEADER: SheetCell[] = ['Fecha', 'Descripción', 'ID de la operación', 'Valor', 'Saldo']

// La descripción no puede contener otra fecha: así un movimiento nunca "se come" al siguiente.
const MOVEMENT =
  /(\d{2}-\d{2}-\d{4})\s+((?:(?!\d{2}-\d{2}-\d{4}).)+?)\s+(\d{8,})\s+\$\s*(-?[\d.]+,\d{2})\s+\$\s*(-?[\d.]+,\d{2})/g

// Encabezados, pies y paginación que se intercalan entre movimientos
// (en la última página el pie aparece ANTES de los movimientos).
const NOISE = [
  /Fecha de generaci[oó]n:\s*\d{2}-\d{2}-\d{4}/gi,
  /Mercado Libre S\.R\.L\..*?www\.mercadopago\.com\.ar/gi,
  /\b\d+\/\d+\b(?=\s|$)/g, // "2/5"
  /Fecha\s+Descripci[oó]n\s+ID de la\s+operaci[oó]n\s+Valor\s+Saldo/gi,
]

export type MercadoPagoStatement = {
  cells: SheetCell[][]
  holder: string | null
  cuit: string | null
  openingBalance: number | null
  closingBalance: number | null
}

export function isMercadoPagoText(text: string): boolean {
  return /RESUMEN DE CUENTA/i.test(text) && /mercadopago|Mercado Libre S\.R\.L\./i.test(text) && /CVU/i.test(text)
}

export function parseMercadoPagoText(rawText: string): MercadoPagoStatement {
  const text = rawText.replace(/\s+/g, ' ')

  const header = text.split(/DETALLE DE MOVIMIENTOS/i)[0] ?? ''
  const opening = header.match(/Saldo inicial:\s*\$\s*(-?[\d.]+,\d{2})/i)
  const closing = header.match(/Saldo final:\s*\$\s*(-?[\d.]+,\d{2})/i)
  const cuit = header.match(/(?<!\d)(\d{11})(?!\d)/)
  const holder = header.match(/RESUMEN DE CUENTA EN PESOS\s+(.+?)\s+CVU/i)

  let body = text.split(/DETALLE DE MOVIMIENTOS/i).slice(1).join(' ')
  for (const re of NOISE) body = body.replace(re, ' ')
  body = body.replace(/\s+/g, ' ')

  const cells: SheetCell[][] = [MERCADOPAGO_HEADER]
  for (const m of body.matchAll(MOVEMENT)) {
    const [, date, description, id, amount, balance] = m
    cells.push([date, description.trim(), id, amount, balance])
  }

  return {
    cells,
    holder: holder?.[1]?.trim() ?? null,
    cuit: cuit?.[1] ?? null,
    openingBalance: opening ? parseAmountCell(opening[1]) : null,
    closingBalance: closing ? parseAmountCell(closing[1]) : null,
  }
}
