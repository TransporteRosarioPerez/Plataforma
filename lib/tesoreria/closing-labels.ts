const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2026-10" → "Octubre 2026" */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-')
  const name = MONTHS[Number(m) - 1] ?? m
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}
