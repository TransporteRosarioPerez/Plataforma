import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import {
  type DashboardPeriod,
  formatPeriodRangeLabel,
  getDashboardPeriodRange,
  getPreviousDashboardPeriodRange,
  isDateWithinRange,
  listMonthBuckets,
  type DateRange,
  type MonthBucket,
} from '@/lib/dashboard/periods'

type InvoiceKpiRow = {
  id: string
  invoice_number: string
  issue_date: string
  paid_date: string | null
  status: string
  subtotal: number
  iva: number
  total: number
  trip_ids: string[] | null
}

type TripDepartureRow = {
  id: string
  code: string
  departure_date: string | null
}

export type CashMonthlyKpi = {
  key: string
  label: string
  invoicedNet: number
  invoicedGross: number
  collectedNet: number
  collectedGross: number
  collectedIva: number
  invoiceCount: number
  collectedCount: number
}

export type CashKpiSummary = {
  invoicedNet: number
  invoicedGross: number
  collectedNet: number
  collectedGross: number
  collectedIva: number
  invoiceCount: number
  collectedCount: number
  pendingToInvoiceCount: number
  pendingToInvoiceAmount: number
  pendingToCollectCount: number
  pendingToCollectNet: number
  pendingToCollectGross: number
}

export type CashCollectionBridgeRow = {
  invoiceId: string
  invoiceNumber: string
  paidDate: string
  collectedNet: number
  tripId: string
  tripCode: string
  tripDepartureDate: string | null
}

export type CashPeriodComparison = {
  invoicedNetDelta: number
  collectedNetDelta: number
  label: string
}

export type CashKpiData = {
  period: DashboardPeriod
  rangeLabel: string
  summary: CashKpiSummary
  monthly: CashMonthlyKpi[]
  comparison: CashPeriodComparison | null
  collectionBridge: CashCollectionBridgeRow[]
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isBillableStatus(status: string) {
  return status === 'emitida' || status === 'cobrada'
}

function emptyMonthly(bucket: MonthBucket): CashMonthlyKpi {
  return {
    key: bucket.key,
    label: bucket.label,
    invoicedNet: 0,
    invoicedGross: 0,
    collectedNet: 0,
    collectedGross: 0,
    collectedIva: 0,
    invoiceCount: 0,
    collectedCount: 0,
  }
}

function summarizeInvoices(invoices: InvoiceKpiRow[], range: DateRange): CashKpiSummary {
  let invoicedNet = 0
  let invoicedGross = 0
  let collectedNet = 0
  let collectedGross = 0
  let collectedIva = 0
  let invoiceCount = 0
  let collectedCount = 0

  for (const inv of invoices) {
    const issueDate = parseDate(inv.issue_date)
    if (issueDate && isBillableStatus(inv.status) && isDateWithinRange(issueDate, range)) {
      invoicedNet += Number(inv.subtotal)
      invoicedGross += Number(inv.total)
      invoiceCount += 1
    }

    if (inv.status === 'cobrada') {
      const paidDate = parseDate(inv.paid_date)
      if (paidDate && isDateWithinRange(paidDate, range)) {
        collectedNet += Number(inv.subtotal)
        collectedGross += Number(inv.total)
        collectedIva += Number(inv.iva)
        collectedCount += 1
      }
    }
  }

  return {
    invoicedNet,
    invoicedGross,
    collectedNet,
    collectedGross,
    collectedIva,
    invoiceCount,
    collectedCount,
    pendingToInvoiceCount: 0,
    pendingToInvoiceAmount: 0,
    pendingToCollectCount: 0,
    pendingToCollectNet: 0,
    pendingToCollectGross: 0,
  }
}

function buildMonthlySeries(invoices: InvoiceKpiRow[], buckets: MonthBucket[]): CashMonthlyKpi[] {
  const byKey = new Map(buckets.map((bucket) => [bucket.key, emptyMonthly(bucket)]))

  for (const inv of invoices) {
    const issueDate = parseDate(inv.issue_date)
    if (issueDate && isBillableStatus(inv.status)) {
      const issueKey = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, '0')}`
      const issueBucket = byKey.get(issueKey)
      if (issueBucket) {
        issueBucket.invoicedNet += Number(inv.subtotal)
        issueBucket.invoicedGross += Number(inv.total)
        issueBucket.invoiceCount += 1
      }
    }

    if (inv.status === 'cobrada') {
      const paidDate = parseDate(inv.paid_date)
      if (paidDate) {
        const paidKey = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}`
        const paidBucket = byKey.get(paidKey)
        if (paidBucket) {
          paidBucket.collectedNet += Number(inv.subtotal)
          paidBucket.collectedGross += Number(inv.total)
          paidBucket.collectedIva += Number(inv.iva)
          paidBucket.collectedCount += 1
        }
      }
    }
  }

  return buckets.map((bucket) => byKey.get(bucket.key)!)
}

function buildCollectionBridge(
  invoices: InvoiceKpiRow[],
  range: DateRange,
  tripsById: Map<string, TripDepartureRow>
): CashCollectionBridgeRow[] {
  const rows: CashCollectionBridgeRow[] = []

  for (const inv of invoices) {
    if (inv.status !== 'cobrada') continue
    const paidDate = parseDate(inv.paid_date)
    if (!paidDate || !isDateWithinRange(paidDate, range)) continue

    for (const tripId of inv.trip_ids ?? []) {
      const trip = tripsById.get(tripId)
      if (!trip) continue
      rows.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        paidDate: paidDate.toISOString().slice(0, 10),
        collectedNet: Number(inv.subtotal),
        tripId: trip.id,
        tripCode: trip.code,
        tripDepartureDate: trip.departure_date,
      })
    }
  }

  return rows.sort((a, b) => b.paidDate.localeCompare(a.paidDate))
}

export const getCashKpis = cache(async (period: DashboardPeriod): Promise<CashKpiData> => {
  await requireSuperadmin()
  const supabase = await createClient()
  const now = new Date()
  const range = getDashboardPeriodRange(period, now)
  const previousRange = getPreviousDashboardPeriodRange(period, now)

  const [invoicesResult, proformasResult, tripsResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, paid_date, status, subtotal, iva, total, trip_ids')
      .is('deleted_at', null),
    supabase
      .from('proformas')
      .select('total, status')
      .is('deleted_at', null)
      .eq('status', 'pendiente'),
    supabase
      .from('trips')
      .select('id, code, departure_date')
      .is('deleted_at', null),
  ])

  if (invoicesResult.error) throw new Error(invoicesResult.error.message)
  if (proformasResult.error) throw new Error(proformasResult.error.message)
  if (tripsResult.error) throw new Error(tripsResult.error.message)

  const invoices = (invoicesResult.data ?? []) as InvoiceKpiRow[]
  const tripsById = new Map(
    ((tripsResult.data ?? []) as TripDepartureRow[]).map((trip) => [trip.id, trip])
  )

  const summary = summarizeInvoices(invoices, range)
  const monthly = buildMonthlySeries(invoices, listMonthBuckets(range))
  const collectionBridge = buildCollectionBridge(invoices, range, tripsById)

  summary.pendingToInvoiceCount = proformasResult.data?.length ?? 0
  summary.pendingToInvoiceAmount =
    proformasResult.data?.reduce((sum, row) => sum + Number(row.total ?? 0), 0) ?? 0

  const pendingInvoices = invoices.filter((inv) => inv.status === 'emitida')
  summary.pendingToCollectCount = pendingInvoices.length
  summary.pendingToCollectNet = pendingInvoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0)
  summary.pendingToCollectGross = pendingInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)

  let comparison: CashPeriodComparison | null = null
  if (previousRange) {
    const previousSummary = summarizeInvoices(invoices, previousRange)
    comparison = {
      invoicedNetDelta: summary.invoicedNet - previousSummary.invoicedNet,
      collectedNetDelta: summary.collectedNet - previousSummary.collectedNet,
      label:
        period === 'current_month'
          ? 'vs mes anterior'
          : period === 'year_to_date'
            ? 'vs mismo período año anterior'
            : 'vs período anterior equivalente',
    }
  }

  return {
    period,
    rangeLabel: formatPeriodRangeLabel(range),
    summary,
    monthly,
    comparison,
    collectionBridge,
  }
})
