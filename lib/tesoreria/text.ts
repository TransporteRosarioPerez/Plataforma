import type { SheetCell } from './types'

/** Mayúsculas, sin acentos y con espacios colapsados. Base para reglas y deduplicación. */
export function normalizeDescription(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normaliza encabezados de columnas: minúsculas, sin acentos ni puntos. */
export function normalizeHeader(value: SheetCell): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Monto desde una celda: número de Excel o texto con formato es-AR
 * ("$ -1.875,64", "-1875,64", "1.234"). Devuelve null si no es interpretable.
 */
export function parseAmountCell(value: SheetCell): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? roundMoney(value) : null
  if (typeof value !== 'string') return null
  let s = value.replace(/\$/g, '').replace(/\s/g, '').trim()
  if (!s) return null
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  }
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return roundMoney(negative ? -n : n)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Serial de Excel (sistema 1900) → yyyy-mm-dd */
export function excelSerialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Fecha desde una celda: serial de Excel, "dd/mm/yyyy" o "yyyy-mm-dd". */
export function parseDateCell(value: SheetCell): string | null {
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    return excelSerialToIso(value)
  }
  if (typeof value !== 'string') return null
  const s = value.trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    const month = Number(m[2])
    const day = Number(m[1])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year}-${pad(month)}-${pad(day)}`
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

/** Valida el dígito verificador de un CUIT/CUIL. */
export function isValidCuit(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false
  if (!['20', '23', '24', '25', '26', '27', '30', '33', '34'].includes(cuit.slice(0, 2))) return false
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((acc, w, i) => acc + w * Number(cuit[i]), 0)
  let check = 11 - (sum % 11)
  if (check === 11) check = 0
  if (check === 10) return false
  return check === Number(cuit[10])
}

/**
 * Extrae el CUIT de la contraparte de una descripción bancaria.
 * Toma el último bloque de 11 dígitos con dígito verificador válido
 * (descarta ids de operación de 11+ dígitos que no son CUIT).
 */
export function extractCuit(description: string): string | null {
  const candidates = description.match(/(?<!\d)\d{11}(?!\d)/g) ?? []
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (isValidCuit(candidates[i])) return candidates[i]
  }
  return null
}
