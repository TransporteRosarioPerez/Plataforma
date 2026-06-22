'use client'

import { ArrowDownRight, ArrowUpRight, Equal, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  formatTripCurrency,
  formatTripMargin,
  getTripEconomics,
  tripEconomicsOutcomeDescriptions,
  tripEconomicsOutcomeLabels,
  type TripEconomicsOutcome,
} from '@/lib/trip-economics'

const outcomeStyles: Record<TripEconomicsOutcome, string> = {
  pending: 'bg-muted text-muted-foreground border-border',
  pending_income: 'bg-amber-500/10 text-amber-800 border-amber-500/30',
  break_even: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
  profit: 'bg-green-500/10 text-green-800 border-green-500/30',
  loss: 'bg-red-500/10 text-red-800 border-red-500/30',
}

const resultTextStyles: Record<TripEconomicsOutcome, string> = {
  pending: 'text-muted-foreground',
  pending_income: 'text-amber-700',
  break_even: 'text-slate-700',
  profit: 'text-green-700',
  loss: 'text-red-700',
}

type TripEconomicsSummaryProps = {
  income: number
  expenses: number
  variant?: 'banner' | 'compact' | 'badge'
  preview?: boolean
  className?: string
}

function OutcomeIcon({ outcome }: { outcome: TripEconomicsOutcome }) {
  if (outcome === 'profit') return <TrendingUp className="h-4 w-4" />
  if (outcome === 'loss') return <TrendingDown className="h-4 w-4" />
  if (outcome === 'pending_income') return <ArrowDownRight className="h-4 w-4" />
  return <Equal className="h-4 w-4" />
}

export function TripEconomicsSummary({
  income,
  expenses,
  variant = 'banner',
  preview = false,
  className,
}: TripEconomicsSummaryProps) {
  const economics = getTripEconomics(income, expenses)
  const margin = formatTripMargin(economics.marginPercent)
  const showResultAmount = economics.outcome !== 'pending' && economics.outcome !== 'pending_income'

  if (variant === 'badge') {
    return (
      <Badge variant="outline" className={cn('font-normal', outcomeStyles[economics.outcome], className)}>
        {tripEconomicsOutcomeLabels[economics.outcome]}
        {economics.outcome === 'profit' || economics.outcome === 'loss' ? (
          <span className="ml-1 tabular-nums">{formatTripCurrency(Math.abs(economics.profit))}</span>
        ) : null}
      </Badge>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-1 text-right', className)}>
        <Badge variant="outline" className={cn('font-normal', outcomeStyles[economics.outcome])}>
          {tripEconomicsOutcomeLabels[economics.outcome]}
        </Badge>
        {showResultAmount && (
          <div className={cn('text-sm font-semibold tabular-nums', resultTextStyles[economics.outcome])}>
            {formatTripCurrency(economics.profit)}
            {margin ? <span className="ml-1 text-xs font-normal opacity-80">({margin})</span> : null}
          </div>
        )}
        {economics.outcome === 'pending_income' && (
          <div className="text-xs text-muted-foreground tabular-nums">
            Gastos {formatTripCurrency(economics.expenses)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm',
        economics.outcome === 'profit' && 'border-green-500/20',
        economics.outcome === 'loss' && 'border-red-500/20',
        economics.outcome === 'pending_income' && 'border-amber-500/20',
        className
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Resultado del viaje</p>
            <Badge variant="outline" className={cn('gap-1 font-normal', outcomeStyles[economics.outcome])}>
              <OutcomeIcon outcome={economics.outcome} />
              {tripEconomicsOutcomeLabels[economics.outcome]}
            </Badge>
            {preview && (
              <span className="text-xs text-muted-foreground">(vista previa)</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {tripEconomicsOutcomeDescriptions[economics.outcome]}
          </p>
        </div>

        <div
          className={cn(
            'rounded-md px-4 py-3 text-right min-w-[180px]',
            economics.outcome === 'profit' && 'bg-green-500/10',
            economics.outcome === 'loss' && 'bg-red-500/10',
            economics.outcome === 'break_even' && 'bg-muted/60',
            (economics.outcome === 'pending' || economics.outcome === 'pending_income') && 'bg-muted/40'
          )}
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {showResultAmount ? 'Resultado neto' : 'Estado'}
          </p>
          <p className={cn('text-2xl font-bold tabular-nums', resultTextStyles[economics.outcome])}>
            {showResultAmount ? formatTripCurrency(economics.profit) : tripEconomicsOutcomeLabels[economics.outcome]}
          </p>
          {margin && (
            <p className={cn('text-sm tabular-nums', resultTextStyles[economics.outcome])}>
              Margen {margin}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">Ingresos</p>
          <p className="text-lg font-semibold tabular-nums text-green-700">
            {economics.income > 0 ? formatTripCurrency(economics.income) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">Lo que cobrás por el viaje</p>
        </div>

        <Minus className="hidden sm:block h-4 w-4 text-muted-foreground mx-auto" aria-hidden />

        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">Egresos</p>
          <p className="text-lg font-semibold tabular-nums text-red-700">
            {economics.expenses > 0 ? formatTripCurrency(economics.expenses) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">Gastos registrados</p>
        </div>

        <Equal className="hidden sm:block h-4 w-4 text-muted-foreground mx-auto" aria-hidden />

        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">Resultado</p>
          <p className={cn('text-lg font-semibold tabular-nums', resultTextStyles[economics.outcome])}>
            {showResultAmount ? formatTripCurrency(economics.profit) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">Ingresos − egresos</p>
        </div>
      </div>

      {economics.outcome === 'pending_income' && economics.expenses > 0 && (
        <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          Incluí el viaje en una proforma con importe para ver si rinde o pierde.
        </p>
      )}
    </div>
  )
}
