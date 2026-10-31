import type {
  BalanceMode,
  SheetCell,
  StatementParseResult,
  StatementRow,
  TreasuryProvider,
} from './types'
import { normalizeHeader, parseAmountCell, parseDateCell } from './text'

type ColumnSpec = {
  date: string[]
  reference: string[]
  description: string[]
  amount: string[]
  balance: string[]
}

type ProviderSpec = {
  provider: TreasuryProvider
  label: string
  /** Columnas que identifican el formato (todas deben estar en la fila de encabezado). */
  signature: string[]
  columns: ColumnSpec
  /**
   * Macro informa el saldo DESPUÉS de cada movimiento.
   * Nación informa el saldo ANTES de cada movimiento.
   */
  balanceMode: BalanceMode
}

const PROVIDERS: ProviderSpec[] = [
  {
    provider: 'macro',
    label: 'Banco Macro',
    signature: ['fecha', 'nro transaccion', 'descripcion', 'importe'],
    columns: {
      date: ['fecha'],
      reference: ['nro transaccion'],
      description: ['descripcion'],
      amount: ['importe'],
      balance: ['saldo'],
    },
    balanceMode: 'after',
  },
  {
    provider: 'nacion',
    label: 'Banco Nación',
    signature: ['fecha', 'comprobante', 'concepto', 'monto'],
    columns: {
      date: ['fecha'],
      reference: ['comprobante'],
      description: ['concepto'],
      amount: ['monto'],
      balance: ['saldo'],
    },
    balanceMode: 'before',
  },
  {
    // Mercado Pago sólo exporta PDF: lib/tesoreria/mercadopago.ts lo convierte a estas celdas.
    provider: 'mercadopago',
    label: 'Mercado Pago',
    signature: ['fecha', 'descripcion', 'id de la operacion', 'valor', 'saldo'],
    columns: {
      date: ['fecha'],
      reference: ['id de la operacion'],
      description: ['descripcion'],
      amount: ['valor'],
      balance: ['saldo'],
    },
    balanceMode: 'after',
  },
]

const HEADER_SCAN_ROWS = 20

function findHeader(cells: SheetCell[][]): { spec: ProviderSpec; headerIndex: number; headers: string[] } | null {
  const limit = Math.min(cells.length, HEADER_SCAN_ROWS)
  for (let i = 0; i < limit; i++) {
    const headers = (cells[i] ?? []).map(normalizeHeader)
    for (const spec of PROVIDERS) {
      if (spec.signature.every((col) => headers.includes(col))) {
        return { spec, headerIndex: i, headers }
      }
    }
  }
  return null
}

export function detectProvider(cells: SheetCell[][]): TreasuryProvider | null {
  return findHeader(cells)?.spec.provider ?? null
}

function columnIndex(headers: string[], names: string[]): number {
  for (const name of names) {
    const idx = headers.indexOf(name)
    if (idx >= 0) return idx
  }
  return -1
}

function cellToText(value: SheetCell): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/**
 * Convierte las celdas de una hoja (Macro o Nación) en filas normalizadas.
 * Las filas sin fecha válida o sin monto se omiten (encabezados, totales, etc.).
 */
export function parseStatement(cells: SheetCell[][]): StatementParseResult {
  const found = findHeader(cells)
  if (!found) {
    throw new Error(
      'Formato no reconocido. Se aceptan extractos de Banco Macro y Banco Nación (.xls) ' +
        'y el resumen de cuenta de Mercado Pago (.pdf).'
    )
  }

  const { spec, headerIndex, headers } = found
  const idx = {
    date: columnIndex(headers, spec.columns.date),
    reference: columnIndex(headers, spec.columns.reference),
    description: columnIndex(headers, spec.columns.description),
    amount: columnIndex(headers, spec.columns.amount),
    balance: columnIndex(headers, spec.columns.balance),
  }

  const rows: StatementRow[] = []
  const errors: string[] = []

  for (let i = headerIndex + 1; i < cells.length; i++) {
    const line = cells[i] ?? []
    if (line.every((c) => cellToText(c) === '')) continue

    const txDate = parseDateCell(line[idx.date] ?? null)
    const amount = parseAmountCell(line[idx.amount] ?? null)
    const description = cellToText(line[idx.description] ?? null)

    if (!txDate || amount === null) {
      // Filas de pie (totales, leyendas) no tienen fecha/monto: se ignoran sin error.
      if (description || cellToText(line[idx.amount] ?? null)) {
        errors.push(`Fila ${i + 1}: no se pudo leer fecha o monto, se omite`)
      }
      continue
    }
    if (!description) {
      errors.push(`Fila ${i + 1}: sin descripción, se omite`)
      continue
    }

    const raw: Record<string, SheetCell> = {}
    headers.forEach((h, c) => {
      if (h) raw[h] = line[c] ?? null
    })

    const reference = idx.reference >= 0 ? cellToText(line[idx.reference] ?? null) : ''
    const informedBalance = idx.balance >= 0 ? parseAmountCell(line[idx.balance] ?? null) : null
    rows.push({
      txDate,
      reference: reference && reference !== '0' ? reference : null,
      description,
      amount,
      // Normalizamos siempre a "saldo después del movimiento".
      bankBalance:
        informedBalance === null
          ? null
          : spec.balanceMode === 'before'
            ? Math.round((informedBalance + amount) * 100) / 100
            : informedBalance,
      statementOrder: 0,
      raw,
    })
  }

  // Los bancos exportan del más nuevo al más viejo; numeramos cronológicamente.
  const descending = rows.length > 1 && rows[0].txDate >= rows[rows.length - 1].txDate
  const total = rows.length
  rows.forEach((row, i) => {
    row.statementOrder = descending ? total - 1 - i : i
  })

  return { provider: spec.provider, rows, errors, balanceMode: spec.balanceMode }
}

export function providerLabel(provider: TreasuryProvider): string {
  return PROVIDERS.find((p) => p.provider === provider)?.label ?? provider
}
