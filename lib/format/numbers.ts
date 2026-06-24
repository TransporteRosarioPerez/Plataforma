type FormatGroupedNumberOptions = {
  decimals?: number
}

export function formatGroupedNumber(
  value: number | null | undefined,
  options: FormatGroupedNumberOptions = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''

  const { decimals = 0 } = options

  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(value)
}

export function parseGroupedNumber(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const normalized = trimmed
    .replace(/\./g, '')
    .replace(',', '.')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function formatGroupedNumberInput(
  raw: string,
  options: FormatGroupedNumberOptions = {}
): string {
  const parsed = parseGroupedNumber(raw)
  if (parsed === undefined) return raw.trim()
  return formatGroupedNumber(parsed, options)
}
