import type { FuelParseResult } from './types'
import { detectFuelProviderOrThrow } from './detect-provider'
import { parseYpfCsv } from './parsers/ypf'
import { parseShellCsv } from './parsers/shell'

export function normalizeFuelCsv(csvText: string): FuelParseResult {
  const provider = detectFuelProviderOrThrow(csvText)
  const result = provider === 'ypf' ? parseYpfCsv(csvText) : parseShellCsv(csvText)

  return {
    provider,
    rows: result.rows,
    skipped: result.skipped,
    errors: result.errors,
  }
}
