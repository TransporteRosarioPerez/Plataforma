import type { NormalizedFuelRow } from '../types'
import {
  classifyProduct,
  hashExternalId,
  normalizePlate,
  parseLocaleNumber,
  rowsToRecords,
  parseCsvText,
} from '../parse-csv'

function parseShellDate(fecha: string, hora: string): Date | null {
  const dateMatch = fecha.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!dateMatch) return null
  const [, d, m, y] = dateMatch
  const timeMatch = (hora ?? '').trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  const h = timeMatch ? Number(timeMatch[1]) : 0
  const min = timeMatch ? Number(timeMatch[2]) : 0
  const s = timeMatch ? Number(timeMatch[3]) : 0
  return new Date(Number(y), Number(m) - 1, Number(d), h, min, s)
}

function isSummaryRow(r: Record<string, string>): boolean {
  const fecha = r['FECHA'] ?? ''
  const unidad = r['UNIDAD'] ?? ''
  // Fila de totales del contrato (sin fecha válida o nombre empresa)
  if (!fecha || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fecha.trim())) return true
  if (unidad.toUpperCase().includes('PEREZ ROSARIO')) return true
  return false
}

export function parseShellCsv(csvText: string): { rows: NormalizedFuelRow[]; skipped: number; errors: string[] } {
  const parsed = parseCsvText(csvText)
  const records = rowsToRecords(parsed)
  const rows: NormalizedFuelRow[] = []
  const errors: string[] = []
  let skipped = 0

  for (let i = 0; i < records.length; i++) {
    const r = records[i]

    if (isSummaryRow(r)) {
      skipped++
      continue
    }

    const fecha = r['FECHA'] ?? ''
    const hora = r['HORA'] ?? ''
    const plate = normalizePlate(r['UNIDAD'] || r['PLACA / IDENTIFICACIÓN'] || r['PLACA / IDENTIFICACION'] || '')
    const product = r['PRODUCTO/SERVICIO'] ?? r['PRODUCTO/SERVICIO '] ?? ''

    if (!plate) {
      skipped++
      continue
    }

    const transactionAt = parseShellDate(fecha, hora)
    if (!transactionAt || Number.isNaN(transactionAt.getTime())) {
      errors.push(`Fila ${i + 2}: fecha inválida "${fecha}"`)
      skipped++
      continue
    }

    const amountNet = parseLocaleNumber(r['NETO'] ?? '0')
    const amountTotal = parseLocaleNumber(r['M.N.'] ?? r['M.N'] ?? '0')
    const amountTaxes = Math.max(0, amountTotal - amountNet)
    const liters = parseLocaleNumber(r['LITROS'] ?? '0')

    const externalId = hashExternalId([
      fecha,
      hora,
      plate,
      liters,
      amountNet,
      product,
    ])

    rows.push({
      provider: 'shell',
      externalId,
      transactionAt,
      plate,
      stationName: r['ESTACIÓN DE SERVICIO'] ?? r['ESTACION DE SERVICIO'] ?? '',
      product,
      productKind: classifyProduct(product),
      liters,
      unitPriceNet: parseLocaleNumber(r['PRECIO LTS CON DESCUENTO'] ?? '0') || null,
      unitPricePvp: null,
      amountNet,
      amountTaxes,
      amountTotal: amountTotal || amountNet + amountTaxes,
      ticketNumber: null,
      driverName: null,
      cardNumber: r['TARJETA'] ?? null,
      rawData: r,
    })
  }

  return { rows, skipped, errors }
}
