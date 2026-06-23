import type { NormalizedFuelRow } from '../types'
import {
  classifyProduct,
  normalizePlate,
  parseLocaleNumber,
  rowsToRecords,
  parseCsvText,
} from '../parse-csv'

function parseYpfDate(value: string): Date | null {
  // dd/mm/yyyy hh:mm:ss
  const match = value.trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/
  )
  if (!match) return null
  const [, d, m, y, h, min, s] = match
  return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s))
}

export function parseYpfCsv(csvText: string): { rows: NormalizedFuelRow[]; skipped: number; errors: string[] } {
  const parsed = parseCsvText(csvText)
  const records = rowsToRecords(parsed)
  const rows: NormalizedFuelRow[] = []
  const errors: string[] = []
  let skipped = 0

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const fecha = r['FECHA'] ?? ''
    const plate = normalizePlate(r['IDENTIFICACION TARJETA'] ?? '')
    const remito = (r['REMITO'] ?? '').trim()

    if (!fecha || !plate) {
      skipped++
      continue
    }

    const transactionAt = parseYpfDate(fecha)
    if (!transactionAt || Number.isNaN(transactionAt.getTime())) {
      errors.push(`Fila ${i + 2}: fecha inválida "${fecha}"`)
      skipped++
      continue
    }

    const amountNet = parseLocaleNumber(r['IMP TOT YER'] ?? '0')
    const iva = parseLocaleNumber(r['IVA'] ?? '0')
    const co2 = parseLocaleNumber(r['IMP CO2'] ?? '0')
    const tasaVial = parseLocaleNumber(r['TASA VIAL'] ?? '0')
    const combLiq = parseLocaleNumber(r['IMP COMB LIQ'] ?? '0')
    const amountTaxes = iva + co2 + tasaVial + combLiq
    const product = r['PRODUCTO'] ?? ''
    const establecimiento = r['ESTABLECIMIENTO'] ?? ''
    const localidad = r['LOCALIDAD'] ?? ''
    const stationName = [establecimiento, localidad].filter(Boolean).join(' — ')

    if (!remito) {
      errors.push(`Fila ${i + 2}: sin REMITO, se omite`)
      skipped++
      continue
    }

    rows.push({
      provider: 'ypf',
      externalId: remito,
      transactionAt,
      plate,
      stationName,
      product,
      productKind: classifyProduct(product),
      liters: parseLocaleNumber(r['LITROS UNIDADES'] ?? '0'),
      unitPriceNet: parseLocaleNumber(r['PRECIO YER'] ?? '0') || null,
      unitPricePvp: parseLocaleNumber(r['PRECIO PVP ESTABLECIMIENTO'] ?? '0') || null,
      amountNet,
      amountTaxes,
      amountTotal: amountNet + amountTaxes,
      ticketNumber: remito,
      driverName: r['CONDUCTOR'] ?? null,
      cardNumber: r['TARJETA'] ?? null,
      rawData: r,
    })
  }

  return { rows, skipped, errors }
}
