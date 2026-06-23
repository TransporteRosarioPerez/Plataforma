'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DASHBOARD_PERIODS,
  dashboardPeriodLabels,
  type DashboardPeriod,
} from '@/lib/dashboard/periods'
import {
  REPORT_VIEWS,
  reportViewLabels,
  type ReportView,
} from '@/lib/dashboard/report-view'
import { formatTripCurrency } from '@/lib/trip-economics'
import { cn } from '@/lib/utils'

export type { ReportView } from '@/lib/dashboard/report-view'
export { REPORT_VIEWS, reportViewLabels } from '@/lib/dashboard/report-view'

export function formatCompactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`
  }
  return formatTripCurrency(value)
}

export function DeltaBadge({
  value,
  format = 'currency',
}: {
  value: number
  format?: 'currency' | 'number'
}) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        Sin cambio
      </span>
    )
  }

  const positive = value > 0
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  const formatted =
    format === 'currency' ? formatTripCurrency(Math.abs(value)) : Math.abs(value).toString()

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        positive ? 'text-green-700' : 'text-red-700'
      )}
    >
      <Icon className="h-3 w-3" />
      {positive ? '+' : '-'}
      {formatted}
    </span>
  )
}

type ReportPeriodControlsProps = {
  period: DashboardPeriod
  rangeLabel: string
}

export function ReportPeriodControls({ period, rangeLabel }: ReportPeriodControlsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setPeriod = (next: DashboardPeriod) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', next)
    router.push(`/app/reportes?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <p className="text-sm text-muted-foreground">Período: {rangeLabel}</p>
      <div className="flex flex-wrap gap-2">
        {DASHBOARD_PERIODS.map((p) => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {dashboardPeriodLabels[p]}
          </Button>
        ))}
      </div>
    </div>
  )
}

type ReportViewTabsProps = {
  view: ReportView
}

export function ReportViewTabs({ view }: ReportViewTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setView = (next: ReportView) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', next)
    router.push(`/app/reportes?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {REPORT_VIEWS.map((v) => (
        <Button
          key={v}
          variant={view === v ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView(v)}
        >
          {reportViewLabels[v]}
        </Button>
      ))}
    </div>
  )
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatReportDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}
