import type { TreasuryCheque } from './types'

export type ForecastFrequency = 'once' | 'weekly' | 'monthly'

export type ForecastItem = {
  id: string
  name: string
  /** positivo = entra, negativo = sale */
  amount: number
  frequency: ForecastFrequency
  startDate: string
  endDate: string | null
  dayOfMonth: number | null
  accountId: string | null
  categoryId: string | null
  isActive: boolean
  notes: string | null
}

export type ForecastOccurrence = {
  date: string
  amount: number
  label: string
  kind: 'item' | 'cheque'
  accountId: string | null
  refId: string
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return iso(d)
}

/** Ocurrencias de los ítems entre `from` y `to` (incluidos). */
export function expandForecastItems(items: ForecastItem[], from: string, to: string): ForecastOccurrence[] {
  const out: ForecastOccurrence[] = []
  for (const item of items) {
    if (!item.isActive) continue
    const last = item.endDate && item.endDate < to ? item.endDate : to
    const push = (date: string) => {
      if (date >= from && date <= last && date >= item.startDate) {
        out.push({ date, amount: item.amount, label: item.name, kind: 'item', accountId: item.accountId, refId: item.id })
      }
    }
    if (item.frequency === 'once') {
      push(item.startDate)
    } else if (item.frequency === 'weekly') {
      // Primera ocurrencia >= from, manteniendo el día de la semana de start_date.
      let date = item.startDate
      if (date < from) {
        const diff = Math.ceil((Date.parse(`${from}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000 / 7) * 7
        date = addDays(date, diff)
      }
      for (; date <= last; date = addDays(date, 7)) push(date)
    } else {
      const day = item.dayOfMonth ?? Number(item.startDate.slice(8, 10))
      const start = new Date(`${from.slice(0, 7)}-01T00:00:00Z`)
      for (let i = 0; i < 24; i++) {
        const y = start.getUTCFullYear()
        const m = start.getUTCMonth() + i
        const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
        const date = iso(new Date(Date.UTC(y, m, Math.min(day, lastDay))))
        if (date > last) break
        push(date)
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** Cheques emitidos todavía no debitados. Sin fecha o con fecha pasada → caen hoy. */
export function chequeOccurrences(cheques: TreasuryCheque[], today: string): ForecastOccurrence[] {
  return cheques
    .filter((c) => c.status === 'emitido')
    .map((c) => ({
      date: !c.paymentDate || c.paymentDate < today ? today : c.paymentDate,
      amount: -c.amount,
      label: `Cheque N° ${c.chequeNumber} · ${c.payeeName}`,
      kind: 'cheque' as const,
      accountId: c.accountId,
      refId: c.id,
    }))
}

export type ForecastWeek = {
  start: string
  end: string
  opening: number
  inflow: number
  outflow: number
  closing: number
  occurrences: ForecastOccurrence[]
}

export type Projection = {
  weeks: ForecastWeek[]
  lowestBalance: number
  lowestWeekStart: string | null
  firstNegativeWeekStart: string | null
}

/**
 * Proyección semanal desde hoy. Cada semana arranca con el cierre de la anterior.
 * `accountId` filtra por cuenta (los ítems sin cuenta se consideran sólo en la vista consolidada).
 */
export function weeklyProjection(params: {
  startBalance: number
  today: string
  weeks: number
  occurrences: ForecastOccurrence[]
  accountId?: string | null
}): Projection {
  const { startBalance, today, weeks: count, accountId } = params
  const occurrences = accountId
    ? params.occurrences.filter((o) => o.accountId === accountId)
    : params.occurrences
  const weeks: ForecastWeek[] = []
  let balance = startBalance
  let lowestBalance = startBalance
  let lowestWeekStart: string | null = null
  let firstNegativeWeekStart: string | null = null
  for (let i = 0; i < count; i++) {
    const start = addDays(today, i * 7)
    const end = addDays(start, 6)
    const inWeek = occurrences.filter((o) => o.date >= start && o.date <= end)
    const inflow = inWeek.filter((o) => o.amount > 0).reduce((a, o) => a + o.amount, 0)
    const outflow = inWeek.filter((o) => o.amount < 0).reduce((a, o) => a - o.amount, 0)
    const opening = balance
    balance = Math.round((balance + inflow - outflow) * 100) / 100
    weeks.push({ start, end, opening, inflow, outflow, closing: balance, occurrences: inWeek })
    if (balance < lowestBalance) {
      lowestBalance = balance
      lowestWeekStart = start
    }
    if (balance < 0 && !firstNegativeWeekStart) firstNegativeWeekStart = start
  }
  return { weeks, lowestBalance, lowestWeekStart, firstNegativeWeekStart }
}
