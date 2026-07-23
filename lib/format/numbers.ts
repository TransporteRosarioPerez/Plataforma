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

/**
 * Parsea un número en formato es-AR (1.500,50) o un decimal JS (1500.5).
 * El punto solo se trata como miles cuando hay coma decimal o cuando
 * los grupos tras el punto tienen exactamente 3 dígitos.
 */
export function parseGroupedNumber(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  // Decimal estilo JS / teclado: "1500.5" o "1500.50" (sin coma, 1–2 decimales)
  if (!trimmed.includes(',') && /^\d+\.\d{1,2}$/.test(trimmed)) {
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const normalized = trimmed.replace(/\./g, '').replace(',', '.')
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

/** Solo dígitos y separadores . / , (sin letras ni otros símbolos). */
export function sanitizeGroupedNumberInput(raw: string, decimals = 0): string {
  if (decimals <= 0) {
    return raw.replace(/[^\d.]/g, '')
  }
  return raw.replace(/[^\d.,]/g, '')
}
