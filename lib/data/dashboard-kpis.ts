import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { INVENTORY_ENABLED } from '@/lib/features'
import { getTripEconomics } from '@/lib/trip-economics'
import {
  type DashboardPeriod,
  getDashboardPeriodRange,
  getPreviousDashboardPeriodRange,
  isDateWithinRange,
  listMonthBuckets,
  type DateRange,
  type MonthBucket,
} from '@/lib/dashboard/periods'

type TripKpiRow = {
  departure_date: string | null
  created_at: string
  total_income: number
  total_expenses: number
  profit: number
  status: string
}

export type MonthlyKpi = {
  key: string
  label: string
  income: number
  expenses: number
  operationalPurchases: number
  profit: number
  tripCount: number
  profitableTrips: number
  lossTrips: number
  pendingIncomeTrips: number
}

export type PeriodKpiSummary = {
  income: number
  expenses: number
  operationalPurchases: number
  profit: number
  marginPercent: number | null
  tripCount: number
  profitableTrips: number
  lossTrips: number
  breakEvenTrips: number
  pendingIncomeTrips: number
  pendingPaymentTrips: number
  pendingPaymentAmount: number
  paidTrips: number
  paidAmount: number
  pendingProformas: number
  pendingProformasAmount: number
  lowStockItems: number
}

export type PeriodComparison = {
  profitDelta: number
  incomeDelta: number
  tripCountDelta: number
  operationalPurchasesDelta: number
  label: string
}

export type DashboardKpiData = {
  period: DashboardPeriod
  rangeLabel: string
  summary: PeriodKpiSummary
  monthly: MonthlyKpi[]
  comparison: PeriodComparison | null
}

function getTripReferenceDate(row: TripKpiRow) {
  return new Date(row.departure_date ?? row.created_at)
}

function emptyMonthly(bucket: MonthBucket): MonthlyKpi {
  return {
    key: bucket.key,
    label: bucket.label,
    income: 0,
    expenses: 0,
    operationalPurchases: 0,
    profit: 0,
    tripCount: 0,
    profitableTrips: 0,
    lossTrips: 0,
    pendingIncomeTrips: 0,
  }
}

function summarizeTrips(trips: TripKpiRow[], range: DateRange): PeriodKpiSummary {
  const inRange = trips.filter((trip) => isDateWithinRange(getTripReferenceDate(trip), range))

  let income = 0
  let expenses = 0
  let profit = 0
  let profitableTrips = 0
  let lossTrips = 0
  let breakEvenTrips = 0
  let pendingIncomeTrips = 0
  let pendingPaymentTrips = 0
  let pendingPaymentAmount = 0
  let paidTrips = 0
  let paidAmount = 0

  for (const trip of inRange) {
    const tripIncome = Number(trip.total_income)
    const tripExpenses = Number(trip.total_expenses)
    const tripProfit = Number(trip.profit)
    const economics = getTripEconomics(tripIncome, tripExpenses)

    income += tripIncome
    expenses += tripExpenses
    profit += tripProfit

    if (economics.outcome === 'profit') profitableTrips += 1
    else if (economics.outcome === 'loss') lossTrips += 1
    else if (economics.outcome === 'break_even') breakEvenTrips += 1
    else if (economics.outcome === 'pending_income') pendingIncomeTrips += 1

    if (trip.status === 'pending_payment') {
      pendingPaymentTrips += 1
      pendingPaymentAmount += tripIncome
    }
    if (trip.status === 'paid') {
      paidTrips += 1
      paidAmount += tripIncome
    }
  }

  return {
    income,
    expenses,
    operationalPurchases: 0,
    profit,
    marginPercent: income > 0 ? (profit / income) * 100 : null,
    tripCount: inRange.length,
    profitableTrips,
    lossTrips,
    breakEvenTrips,
    pendingIncomeTrips,
    pendingPaymentTrips,
    pendingPaymentAmount,
    paidTrips,
    paidAmount,
    pendingProformas: 0,
    pendingProformasAmount: 0,
    lowStockItems: 0,
  }
}

type PurchaseRow = {
  total_cost: number
  movement_date: string
}

function summarizePurchases(purchases: PurchaseRow[], range: DateRange): number {
  return purchases
    .filter((row) => isDateWithinRange(new Date(row.movement_date), range))
    .reduce((sum, row) => sum + Number(row.total_cost ?? 0), 0)
}

function buildPurchaseMonthlySeries(purchases: PurchaseRow[], buckets: MonthBucket[]): number[] {
  return buckets.map((bucket) => {
    return purchases
      .filter((row) => {
        const date = new Date(row.movement_date)
        return date >= bucket.from && date <= bucket.to
      })
      .reduce((sum, row) => sum + Number(row.total_cost ?? 0), 0)
  })
}

function buildMonthlySeries(trips: TripKpiRow[], buckets: MonthBucket[]): MonthlyKpi[] {
  const byKey = new Map(buckets.map((bucket) => [bucket.key, emptyMonthly(bucket)]))

  for (const trip of trips) {
    const date = getTripReferenceDate(trip)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const bucket = byKey.get(key)
    if (!bucket) continue

    const tripIncome = Number(trip.total_income)
    const tripExpenses = Number(trip.total_expenses)
    const economics = getTripEconomics(tripIncome, tripExpenses)

    bucket.income += tripIncome
    bucket.expenses += tripExpenses
    bucket.profit += Number(trip.profit)
    bucket.tripCount += 1

    if (economics.outcome === 'profit') bucket.profitableTrips += 1
    else if (economics.outcome === 'loss') bucket.lossTrips += 1
    else if (economics.outcome === 'pending_income') bucket.pendingIncomeTrips += 1
  }

  return buckets.map((bucket) => byKey.get(bucket.key)!)
}

export const getDashboardKpis = cache(async (period: DashboardPeriod): Promise<DashboardKpiData> => {
  const supabase = await createClient()
  const now = new Date()
  const range = getDashboardPeriodRange(period, now)
  const previousRange = getPreviousDashboardPeriodRange(period, now)

  const [tripsResult, proformasResult, purchasesResult, inventoryResult] = await Promise.all([
    supabase
      .from('trips')
      .select('departure_date, created_at, total_income, total_expenses, profit, status')
      .is('deleted_at', null),
    supabase
      .from('proformas')
      .select('total, status')
      .is('deleted_at', null)
      .eq('status', 'pendiente'),
    INVENTORY_ENABLED
      ? supabase
          .from('inventory_movements')
          .select('total_cost, movement_date')
          .eq('movement_type', 'purchase')
          .is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
    INVENTORY_ENABLED
      ? supabase
          .from('inventory_items')
          .select('current_quantity, min_quantity, is_active')
          .is('deleted_at', null)
      : Promise.resolve({ data: null, error: null }),
  ])

  if (tripsResult.error) throw new Error(tripsResult.error.message)
  if (purchasesResult.error) throw new Error(purchasesResult.error.message)

  const trips = (tripsResult.data ?? []) as TripKpiRow[]
  const purchases = (purchasesResult.data ?? []) as PurchaseRow[]
  const summary = summarizeTrips(trips, range)
  const monthly = buildMonthlySeries(trips, listMonthBuckets(range))
  const purchaseMonthly = INVENTORY_ENABLED
    ? buildPurchaseMonthlySeries(purchases, listMonthBuckets(range))
    : []

  summary.operationalPurchases = INVENTORY_ENABLED ? summarizePurchases(purchases, range) : 0
  summary.lowStockItems = INVENTORY_ENABLED
    ? inventoryResult.data?.filter(
        (row) =>
          row.is_active &&
          Number(row.current_quantity) <= Number(row.min_quantity)
      ).length ?? 0
    : 0

  if (INVENTORY_ENABLED) {
    monthly.forEach((month, index) => {
      month.operationalPurchases = purchaseMonthly[index] ?? 0
    })
  }

  summary.pendingProformas = proformasResult.data?.length ?? 0
  summary.pendingProformasAmount =
    proformasResult.data?.reduce((sum, row) => sum + Number(row.total ?? 0), 0) ?? 0

  let comparison: PeriodComparison | null = null
  if (previousRange) {
    const previousSummary = summarizeTrips(trips, previousRange)
    const previousPurchases = summarizePurchases(purchases, previousRange)
    comparison = {
      profitDelta: summary.profit - previousSummary.profit,
      incomeDelta: summary.income - previousSummary.income,
      tripCountDelta: summary.tripCount - previousSummary.tripCount,
      operationalPurchasesDelta: summary.operationalPurchases - previousPurchases,
      label:
        period === 'current_month'
          ? 'vs mes anterior'
          : period === 'year_to_date'
            ? 'vs mismo período año anterior'
            : 'vs período anterior equivalente',
    }
  }

  const rangeFormatter = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return {
    period,
    rangeLabel: `${rangeFormatter.format(range.from)} – ${rangeFormatter.format(range.to)}`,
    summary,
    monthly,
    comparison,
  }
})
