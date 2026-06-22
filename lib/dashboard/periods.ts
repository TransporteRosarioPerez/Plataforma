export type DashboardPeriod =
  | 'current_month'
  | 'previous_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'year_to_date'
  | 'last_12_months'

export const DASHBOARD_PERIODS: DashboardPeriod[] = [
  'current_month',
  'previous_month',
  'last_3_months',
  'last_6_months',
  'year_to_date',
  'last_12_months',
]

export const dashboardPeriodLabels: Record<DashboardPeriod, string> = {
  current_month: 'Este mes',
  previous_month: 'Mes anterior',
  last_3_months: 'Últimos 3 meses',
  last_6_months: 'Últimos 6 meses',
  year_to_date: 'Año en curso',
  last_12_months: 'Últimos 12 meses',
}

const monthFormatter = new Intl.DateTimeFormat('es-AR', {
  month: 'short',
  year: '2-digit',
})

export type DateRange = {
  from: Date
  to: Date
}

export type MonthBucket = {
  key: string
  label: string
  from: Date
  to: Date
}

export function parseDashboardPeriod(value?: string | null): DashboardPeriod {
  if (value && DASHBOARD_PERIODS.includes(value as DashboardPeriod)) {
    return value as DashboardPeriod
  }
  return 'current_month'
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

export function getDashboardPeriodRange(period: DashboardPeriod, now = new Date()): DateRange {
  const today = startOfDay(now)

  switch (period) {
    case 'current_month':
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'previous_month': {
      const month = addMonths(today, -1)
      return { from: startOfMonth(month), to: endOfMonth(month) }
    }
    case 'last_3_months':
      return { from: startOfMonth(addMonths(today, -2)), to: endOfMonth(today) }
    case 'last_6_months':
      return { from: startOfMonth(addMonths(today, -5)), to: endOfMonth(today) }
    case 'year_to_date':
      return { from: new Date(today.getFullYear(), 0, 1), to: endOfDay(today) }
    case 'last_12_months':
      return { from: startOfMonth(addMonths(today, -11)), to: endOfMonth(today) }
  }
}

export function getPreviousDashboardPeriodRange(period: DashboardPeriod, now = new Date()): DateRange | null {
  switch (period) {
    case 'current_month':
      return getDashboardPeriodRange('previous_month', now)
    case 'previous_month': {
      const twoMonthsAgo = addMonths(now, -2)
      return { from: startOfMonth(twoMonthsAgo), to: endOfMonth(twoMonthsAgo) }
    }
    case 'last_3_months':
      return {
        from: startOfMonth(addMonths(now, -5)),
        to: endOfMonth(addMonths(now, -3)),
      }
    case 'last_6_months':
      return {
        from: startOfMonth(addMonths(now, -11)),
        to: endOfMonth(addMonths(now, -6)),
      }
    case 'year_to_date': {
      const lastYear = now.getFullYear() - 1
      return {
        from: new Date(lastYear, 0, 1),
        to: endOfDay(new Date(lastYear, now.getMonth(), now.getDate())),
      }
    }
    case 'last_12_months':
      return {
        from: startOfMonth(addMonths(now, -23)),
        to: endOfMonth(addMonths(now, -12)),
      }
  }
}

export function listMonthBuckets(range: DateRange): MonthBucket[] {
  const buckets: MonthBucket[] = []
  let cursor = startOfMonth(range.from)

  while (cursor <= range.to) {
    const from = startOfMonth(cursor)
    const to = endOfMonth(cursor)
    const key = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`

    buckets.push({
      key,
      label: monthFormatter.format(from),
      from,
      to,
    })

    cursor = addMonths(cursor, 1)
  }

  return buckets
}

export function isDateWithinRange(date: Date, range: DateRange) {
  return date >= range.from && date <= range.to
}

export function formatPeriodRangeLabel(range: DateRange) {
  const sameMonth =
    range.from.getFullYear() === range.to.getFullYear() &&
    range.from.getMonth() === range.to.getMonth()

  const dayFormatter = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  if (sameMonth) {
    return `${dayFormatter.format(range.from)} – ${dayFormatter.format(range.to)}`
  }

  return `${dayFormatter.format(range.from)} – ${dayFormatter.format(range.to)}`
}
