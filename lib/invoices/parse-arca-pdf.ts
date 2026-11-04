/**
 * Lee una factura electrónica de ARCA (comprobante A/B/C o FCE MiPyMEs).
 *
 * Lo importante es el pie: neto, IVA y total tal como los autorizó ARCA.
 * ARCA calcula el IVA línea por línea y redondea cada una, así que puede
 * diferir en centavos de "neto total × 21%". Por eso se guardan los importes
 * impresos y no un recálculo.
 */
import { parseArAmount, parseDmyDate, roundCents } from '@/lib/pdf/numbers'

export type ArcaInvoiceLine = {
  description: string
  subtotal: number
  totalWithIva: number
}

export type ArcaInvoiceParse = {
  /** 00002-00000250 */
  invoiceNumber: string | null
  invoiceType: 'A' | 'B' | 'C' | null
  issueDate: string | null
  issuerCuit: string | null
  clientCuit: string | null
  neto: number | null
  iva: number | null
  total: number | null
  /** Números de proforma mencionados en las líneas (183853…). */
  proformaRefs: string[]
  /**
   * Proformas completas según el detalle de Arcor ("Proforma 183853 … Compañía 01
   * Jurisdiccion 02" → 183853-01-02), en el formato que usa la plataforma.
   */
  proformaNumbers: string[]
  lines: ArcaInvoiceLine[]
  errors: string[]
}

const AR_AMOUNT = String.raw`-?\d+(?:\.\d{3})*,\d{2}`

function amountAfter(text: string, label: RegExp): number | null {
  const m = text.match(new RegExp(label.source + String.raw`\s*:?\s*\$?\s*(` + AR_AMOUNT + ')', 'i'))
  return m ? parseArAmount(m[1]) : null
}

export function looksLikeArcaInvoice(pages: string[][]): boolean {
  const text = pages.flat().join('\n')
  return /Punto de Venta/i.test(text) && /Comp\.? Nro/i.test(text) && /Importe Total/i.test(text)
}

export function parseArcaInvoice(pages: string[][]): ArcaInvoiceParse {
  const lines = pages.flat()
  const text = lines.join('\n')
  const errors: string[] = []

  const pv = text.match(/Punto de Venta:?\s*(\d+)/i)?.[1]
  const nro = text.match(/Comp\.? Nro:?\s*(\d+)/i)?.[1]
  const invoiceNumber =
    pv && nro ? `${pv.padStart(5, '0')}-${nro.padStart(8, '0')}` : null

  // Código de comprobante de ARCA: 1/201 = Factura A, 6/206 = B, 11/211 = C;
  // 2-3/202-203 (y equivalentes) son notas de débito/crédito.
  const codeRaw = text.match(/C[OÓ]D\.?\s*(\d{1,3})/i)?.[1]
  const code = codeRaw ? Number(codeRaw) % 200 : null
  const invoiceType: 'A' | 'B' | 'C' | null =
    code == null ? null : code <= 5 ? 'A' : code <= 10 ? 'B' : code <= 15 ? 'C' : null
  const isNote = code != null && [2, 3, 7, 8, 12, 13].includes(code)

  const dateRaw = text.match(/Fecha de Emisi[oó]n:?\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]
  const cuits = Array.from(text.matchAll(/CUIT:?\s*(\d{11})/gi)).map((m) => m[1])
  const issuerCuit = cuits[0] ?? null
  const clientCuit = cuits.find((c) => c !== issuerCuit) ?? null

  const neto = amountAfter(text, /Importe Neto Gravado/)
  const total = amountAfter(text, /Importe Total/)
  // Suma de todas las alícuotas (normalmente sólo 21%)
  let iva: number | null = null
  for (const m of text.matchAll(new RegExp(String.raw`IVA\s+\d+(?:[.,]\d+)?%\s*:?\s*\$?\s*(` + AR_AMOUNT + ')', 'gi'))) {
    const v = parseArAmount(m[1])
    if (v != null) iva = roundCents((iva ?? 0) + v)
  }

  const itemLines: ArcaInvoiceLine[] = []
  const itemRe = new RegExp(
    String.raw`^(.*?)\s+\d+,\d{2}\s+\S+\s+(` + AR_AMOUNT + String.raw`)\s+\d+,\d{2}\s+(` + AR_AMOUNT + String.raw`)\s+\d+(?:[.,]\d+)?%\s+(` + AR_AMOUNT + ')$'
  )
  for (const line of lines) {
    const m = line.match(itemRe)
    if (!m) continue
    const subtotal = parseArAmount(m[3])
    const withIva = parseArAmount(m[4])
    if (subtotal == null || withIva == null) continue
    itemLines.push({ description: m[1].trim(), subtotal, totalWithIva: withIva })
  }

  // "Proforma 183853" (con mayúscula) es la proforma; "Corte de proforma 963037"
  // (minúscula) es el corte y se ignora.
  const proformaRefs: string[] = []
  const proformaNumbers: string[] = []
  let currentRef: string | null = null
  const tokenRe = /\bProforma\s+(\d{5,})|[Cc]ompa[ñn][ií]a\s+(\d+)\s+[Jj]urisdicci[oó]n\s+(\d+)/g
  for (const m of text.matchAll(tokenRe)) {
    if (m[1]) {
      currentRef = m[1]
      if (!proformaRefs.includes(m[1])) proformaRefs.push(m[1])
    } else if (currentRef && m[2] && m[3]) {
      const pad = (v: string) => String(Number.parseInt(v, 10)).padStart(2, '0')
      const number = `${currentRef}-${pad(m[2])}-${pad(m[3])}`
      if (!proformaNumbers.includes(number)) proformaNumbers.push(number)
    }
  }

  if (isNote) errors.push('El PDF es una nota de crédito o débito, no una factura')
  if (!invoiceNumber) errors.push('No se encontró el punto de venta y número de comprobante')
  if (neto == null) errors.push('No se encontró el Importe Neto Gravado')
  if (total == null) errors.push('No se encontró el Importe Total')
  if (neto != null && total != null && iva != null && Math.abs(roundCents(neto + iva) - total) > 0.01) {
    errors.push('Neto + IVA no da el total impreso en la factura')
  }

  return {
    invoiceNumber,
    invoiceType,
    issueDate: dateRaw ? parseDmyDate(dateRaw) : null,
    issuerCuit,
    clientCuit,
    neto,
    iva,
    total,
    proformaRefs,
    proformaNumbers,
    lines: itemLines,
    errors,
  }
}
