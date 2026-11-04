/**
 * Control de una proforma cargada desde PDF contra lo que se va a guardar.
 *
 * Regla: el PDF manda. Se puede guardar sólo si cada viaje del PDF está en la
 * proforma con el mismo importe, no hay viajes de más y los totales de cada
 * corte cierran al centavo.
 */
import { roundCents } from '@/lib/pdf/numbers'
import type { ArcorProformaGroup, ArcorProformaRow } from '@/lib/proformas/parse-arcor-pdf'

/** Cómo entra el viaje a la proforma según dónde esté facturado hoy. */
export type TripMatchKind =
  /** Libre: entra como línea normal. */
  | 'free'
  /** Ya está en una proforma de otra compañía (ej. Arcor + Bagley): línea normal compartida. */
  | 'shared'
  /** Ya facturado para esta misma compañía (otra proforma o sistema anterior): entra como ajuste. */
  | 'adjustment'
  /** Existe pero no se puede facturar (ej. cancelado). */
  | 'not_billable'

export type TripMatch = {
  tripId: string
  code: string
  status: string
  kind: TripMatchKind
  /** Números de proforma donde ya figura el viaje. */
  otherProformas: string[]
}

export type PdfRowState = 'ok' | 'amount_diff' | 'missing_trip' | 'not_in_proforma' | 'not_billable'

export type PdfRowReview = {
  row: ArcorProformaRow
  match: TripMatch | null
  lineAmount: number | null
  diff: number
  state: PdfRowState
}

export type CorteReview = {
  corte: string
  printedTotal: number | null
  pdfRowsTotal: number
  linesTotal: number
  /** El PDF se contradice: la suma de sus filas no da su TOTALES. */
  pdfInconsistent: boolean
  ok: boolean
}

export type ProformaPdfReview = {
  rows: PdfRowReview[]
  cortes: CorteReview[]
  /** Viajes cargados en la proforma que no figuran en el PDF. */
  extraTripIds: string[]
  pdfTotal: number
  linesTotal: number
  diff: number
  ok: boolean
  problems: string[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n)

export function reviewProformaPdf(
  group: ArcorProformaGroup,
  matches: Record<string, TripMatch | null>,
  lineAmountByTrip: Map<string, number>
): ProformaPdfReview {
  const pdfTripIds = new Set<string>()
  // Si un viaje aparece en más de una fila, su línea tiene que dar la suma.
  const expectedByCode = new Map<string, number>()
  for (const row of group.rows) {
    expectedByCode.set(row.code, roundCents((expectedByCode.get(row.code) ?? 0) + row.amount))
  }

  const rows: PdfRowReview[] = group.rows.map((row) => {
    const match = matches[row.code] ?? null
    if (!match) return { row, match, lineAmount: null, diff: row.amount, state: 'missing_trip' }
    pdfTripIds.add(match.tripId)
    if (match.kind === 'not_billable') {
      return { row, match, lineAmount: null, diff: row.amount, state: 'not_billable' }
    }
    const lineAmount = lineAmountByTrip.get(match.tripId)
    if (lineAmount == null) return { row, match, lineAmount: null, diff: row.amount, state: 'not_in_proforma' }
    const diff = roundCents(lineAmount - (expectedByCode.get(row.code) ?? row.amount))
    return { row, match, lineAmount, diff, state: diff === 0 ? 'ok' : 'amount_diff' }
  })

  const cortes: CorteReview[] = group.cortes.map((c) => {
    const corteRows = rows.filter((r) => r.row.corte === c.corte)
    // Lo que la proforma asigna a las filas de este corte (si la fila cierra, su importe del PDF)
    const linesTotal = roundCents(
      corteRows.reduce((s, r) => s + (r.state === 'ok' ? r.row.amount : (r.lineAmount ?? 0)), 0)
    )
    const pdfInconsistent = c.printedTotal == null || roundCents(c.printedTotal - c.rowsTotal) !== 0
    const expected = c.printedTotal ?? c.rowsTotal
    return {
      corte: c.corte,
      printedTotal: c.printedTotal,
      pdfRowsTotal: c.rowsTotal,
      linesTotal,
      pdfInconsistent,
      ok: !pdfInconsistent && roundCents(linesTotal - expected) === 0,
    }
  })

  const extraTripIds = Array.from(lineAmountByTrip.keys()).filter((id) => !pdfTripIds.has(id))
  const linesTotal = roundCents(Array.from(lineAmountByTrip.values()).reduce((s, v) => s + v, 0))
  const diff = roundCents(linesTotal - group.total)

  const problems: string[] = []
  const missing = rows.filter((r) => r.state === 'missing_trip')
  if (missing.length > 0) {
    problems.push(
      `${missing.length} viaje${missing.length === 1 ? '' : 's'} del PDF no existe${missing.length === 1 ? '' : 'n'} en la plataforma (${missing.map((r) => r.row.code).join(', ')})`
    )
  }
  const notBillable = rows.filter((r) => r.state === 'not_billable')
  if (notBillable.length > 0) {
    problems.push(`Viajes que no se pueden facturar: ${notBillable.map((r) => r.row.code).join(', ')}`)
  }
  const notIn = rows.filter((r) => r.state === 'not_in_proforma')
  if (notIn.length > 0) problems.push(`Falta${notIn.length === 1 ? '' : 'n'} en la proforma: ${notIn.map((r) => r.row.code).join(', ')}`)
  const diffs = rows.filter((r) => r.state === 'amount_diff')
  for (const r of diffs) {
    problems.push(
      `Viaje ${r.row.code}: el PDF dice ${fmt(expectedByCode.get(r.row.code) ?? r.row.amount)} y la proforma ${fmt(r.lineAmount ?? 0)}`
    )
  }
  if (extraTripIds.length > 0) {
    problems.push(`${extraTripIds.length} viaje${extraTripIds.length === 1 ? '' : 's'} de la proforma no figura${extraTripIds.length === 1 ? '' : 'n'} en el PDF`)
  }
  for (const c of cortes.filter((c) => c.pdfInconsistent)) {
    problems.push(
      c.printedTotal == null
        ? `Corte ${c.corte}: no se encontró la línea TOTALES en el PDF`
        : `Corte ${c.corte}: las filas del PDF suman ${fmt(c.pdfRowsTotal)} pero el PDF dice ${fmt(c.printedTotal)}`
    )
  }
  if (diff !== 0) problems.push(`El total de la proforma difiere del PDF en ${fmt(diff)}`)

  return {
    rows,
    cortes,
    extraTripIds,
    pdfTotal: group.total,
    linesTotal,
    diff,
    ok: problems.length === 0,
    problems,
  }
}
