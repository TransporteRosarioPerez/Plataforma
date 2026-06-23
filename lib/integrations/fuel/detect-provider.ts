import type { FuelProvider } from './types'
import { parseCsvText, rowsToRecords } from './parse-csv'

export function detectFuelProvider(csvText: string): FuelProvider | null {
  const rows = parseCsvText(csvText)
  if (rows.length === 0) return null
  const headers = rows[0].map((h) => h.trim().toUpperCase())

  if (headers.includes('IDENTIFICACION TARJETA') && headers.includes('IMP TOT YER')) {
    return 'ypf'
  }
  if (
    headers.some((h) => h.includes('PLACA') && h.includes('IDENTIFIC')) &&
    headers.includes('MONEDERO')
  ) {
    return 'shell'
  }
  return null
}

export function detectFuelProviderOrThrow(csvText: string): FuelProvider {
  const provider = detectFuelProvider(csvText)
  if (!provider) {
    throw new Error(
      'Formato de CSV no reconocido. Debe ser un extracto YPF o Shell con encabezados estándar.'
    )
  }
  return provider
}

export function parseCsvRecords(csvText: string): Record<string, string>[] {
  const rows = parseCsvText(csvText)
  return rowsToRecords(rows)
}
