/** Redondea a centavos (evita guardar 116226879.58999997). */
export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** "1,324,617.96" (formato de las proformas de Arcor) → 1324617.96 */
export function parseUsAmount(raw: string): number | null {
  const clean = raw.trim()
  if (!/^-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^-?\d+(\.\d{1,2})?$/.test(clean)) return null
  return roundCents(Number(clean.replace(/,/g, '')))
}

/** "116226879,59" o "116.226.879,59" (formato de ARCA) → 116226879.59 */
export function parseArAmount(raw: string): number | null {
  const clean = raw.trim().replace(/^\$\s*/, '')
  if (!/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/.test(clean)) return null
  return roundCents(Number(clean.replace(/\./g, '').replace(',', '.')))
}

/** "19/10/26" o "21/10/2026" → "2026-10-19" */
export function parseDmyDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/)
  if (!m) return null
  const year = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${year}-${m[2]}-${m[1]}`
}
