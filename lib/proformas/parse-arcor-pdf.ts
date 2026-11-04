/**
 * Lee el "Resumen de viajes proformados" de Grupo Arcor (Arcor y Bagley).
 *
 * Estructura del PDF (una hoja por corte, o varias si el corte es largo):
 *   NRO PROFORMA 183853
 *   NRO CORTE POR PROFORMA 963054
 *   COMPAÑIA 00001 ARCOR S.A.I.C.
 *   CUIT 30502793175
 *   JURISDICCION 02
 *   27/01/26 AH553HZ-00 22447830 EZEIZA (B.A.) RIO GALLEGOS 286,429.46 30.00 PL 1,324,617.96 1,324,617.96
 *   TOTALES 1,324,617.96 1,324,617.96
 *
 * Las hojas de continuación no repiten el encabezado: heredan el corte anterior.
 * Un mismo PDF puede traer varias compañías o jurisdicciones; cada combinación
 * es una proforma distinta en la plataforma (183853-01-02, 183853-33-02…).
 */
import { parseDmyDate, parseUsAmount, roundCents } from '@/lib/pdf/numbers'

export type ArcorProformaRow = {
  corte: string
  /** Fecha del viaje (aaaa-mm-dd). */
  date: string
  plate: string
  /** Número de carga = código del viaje en la plataforma. */
  code: string
  /** Texto de origen/destino tal como viene (puede venir cortado). */
  route: string
  /** Importe total de la fila. */
  amount: number
  page: number
}

export type ArcorProformaCorte = {
  corte: string
  rowsTotal: number
  /** Lo que imprime la línea TOTALES; null si el corte no la trae. */
  printedTotal: number | null
}

export type ArcorProformaGroup = {
  /** Número como se guarda en la plataforma: 183853-01-02 */
  proformaNumber: string
  baseNumber: string
  companyCode: string
  companyName: string
  cuit: string | null
  jurisdiction: string
  /** Fecha impresa en la hoja (aaaa-mm-dd). */
  issueDate: string | null
  rows: ArcorProformaRow[]
  cortes: ArcorProformaCorte[]
  /** Suma de los TOTALES impresos (o de las filas si falta alguno). */
  total: number
}

export type ArcorProformaParse = {
  groups: ArcorProformaGroup[]
  /** Problemas de lectura que impiden confiar en el resultado. */
  errors: string[]
}

const ROW_RE = /^(\d{2}\/\d{2}\/\d{2})\s+(\S+)\s+(\d{5,})\s+(.*)$/
const AMOUNT_RE = /-?\d{1,3}(?:,\d{3})*\.\d{2}/g

export function looksLikeArcorProforma(pages: string[][]): boolean {
  const text = pages.flat().join('\n')
  return /RESUMEN DE VIAJES PROFORMADOS/i.test(text) && /NRO PROFORMA/i.test(text)
}

function pad2(code: string) {
  return String(Number.parseInt(code, 10)).padStart(2, '0')
}

export function parseArcorProforma(pages: string[][]): ArcorProformaParse {
  const errors: string[] = []
  const groups = new Map<string, ArcorProformaGroup>()
  const corteTotals = new Map<string, { rows: number; printed: number | null; group: string }>()

  let base = ''
  let corte = ''
  let company = ''
  let companyName = ''
  let cuit: string | null = null
  let jurisdiction = ''
  let issueDate: string | null = null

  const currentGroup = (): ArcorProformaGroup | null => {
    if (!base || !company || !jurisdiction) return null
    const key = `${base}-${pad2(company)}-${pad2(jurisdiction)}`
    let group = groups.get(key)
    if (!group) {
      group = {
        proformaNumber: key,
        baseNumber: base,
        companyCode: pad2(company),
        companyName,
        cuit,
        jurisdiction: pad2(jurisdiction),
        issueDate,
        rows: [],
        cortes: [],
        total: 0,
      }
      groups.set(key, group)
    }
    return group
  }

  pages.forEach((lines, pageIndex) => {
    for (const line of lines) {
      let m: RegExpMatchArray | null
      if ((m = line.match(/^HOJA NRO .*?(\d{2}\/\d{2}\/\d{2})\s*$/))) {
        issueDate = parseDmyDate(m[1]) ?? issueDate
      } else if ((m = line.match(/^NRO PROFORMA\s+(\d+)/))) {
        base = m[1]
      } else if ((m = line.match(/CORTE POR PROFORMA\s+(\d+)/))) {
        corte = m[1]
      } else if ((m = line.match(/^COMPA\S*\s+(\d+)\s*(.*)$/))) {
        company = m[1]
        companyName = m[2].trim()
      } else if ((m = line.match(/^CUIT\s+(\d{11})/))) {
        cuit = m[1]
      } else if ((m = line.match(/^JURISDICCION\s+(\d+)/))) {
        jurisdiction = m[1]
      } else if ((m = line.match(ROW_RE))) {
        const group = currentGroup()
        const amounts = m[4].match(AMOUNT_RE) ?? []
        const amount = amounts.length > 0 ? parseUsAmount(amounts[amounts.length - 1]) : null
        const date = parseDmyDate(m[1])
        if (!group || !corte) {
          errors.push(`Hoja ${pageIndex + 1}: viaje ${m[3]} sin encabezado de proforma`)
          continue
        }
        if (amount == null || !date) {
          errors.push(`Hoja ${pageIndex + 1}: no se pudo leer el importe del viaje ${m[3]}`)
          continue
        }
        const firstAmount = m[4].search(/\d{1,3}(?:,\d{3})*\.\d{2}/)
        group.rows.push({
          corte,
          date,
          plate: m[2],
          code: m[3],
          route: (firstAmount > 0 ? m[4].slice(0, firstAmount) : m[4]).trim(),
          amount,
          page: pageIndex + 1,
        })
        const key = `${group.proformaNumber}#${corte}`
        const ct = corteTotals.get(key) ?? { rows: 0, printed: null, group: group.proformaNumber }
        ct.rows = roundCents(ct.rows + amount)
        corteTotals.set(key, ct)
      } else if ((m = line.match(/^TOTALES\s+(.*)$/))) {
        const group = currentGroup()
        const amounts = m[1].match(AMOUNT_RE) ?? []
        const printed = amounts.length > 0 ? parseUsAmount(amounts[amounts.length - 1]) : null
        if (!group || !corte) continue
        const key = `${group.proformaNumber}#${corte}`
        const ct = corteTotals.get(key) ?? { rows: 0, printed: null, group: group.proformaNumber }
        ct.printed = printed
        corteTotals.set(key, ct)
      }
    }
  })

  for (const [key, ct] of corteTotals) {
    const group = groups.get(ct.group)
    if (!group) continue
    group.cortes.push({ corte: key.split('#')[1], rowsTotal: ct.rows, printedTotal: ct.printed })
  }

  for (const group of groups.values()) {
    group.total = roundCents(
      group.cortes.reduce((sum, c) => sum + (c.printedTotal ?? c.rowsTotal), 0)
    )
  }

  if (groups.size === 0) errors.push('No se encontró ninguna proforma en el PDF')

  return { groups: Array.from(groups.values()), errors }
}
