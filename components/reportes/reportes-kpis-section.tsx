'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Route,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  Wallet,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DASHBOARD_PERIODS,
  dashboardPeriodLabels,
  type DashboardPeriod,
} from '@/lib/dashboard/periods'
import type { DashboardKpiData } from '@/lib/data/dashboard-kpis'
import { INVENTORY_ENABLED } from '@/lib/features'
import { formatTripCurrency, formatTripMargin } from '@/lib/trip-economics'
import { cn } from '@/lib/utils'

const chartConfig = {
  income: {
    label: 'Ingresos',
    color: 'var(--chart-2)',
  },
  expenses: {
    label: 'Egresos viajes',
    color: 'var(--chart-1)',
  },
  profit: {
    label: 'Resultado viajes',
    color: 'var(--chart-3)',
  },
  operationalPurchases: {
    label: 'Compras operativas',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig

function formatCompactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`
  }
  return formatTripCurrency(value)
}

function DeltaBadge({
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

type ReportesKpisSectionProps = {
  data: DashboardKpiData
}

export function ReportesKpisSection({ data }: ReportesKpisSectionProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { summary, monthly, comparison } = data

  const setPeriod = (period: DashboardPeriod) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', period)
    router.push(`/app/reportes?${params.toString()}`)
  }

  const chartData = monthly.map((month) => ({
    month: month.label,
    income: month.income,
    expenses: month.expenses,
    ...(INVENTORY_ENABLED ? { operationalPurchases: month.operationalPurchases } : {}),
    profit: month.profit,
  }))

  const resultTone =
    summary.profit > 0 ? 'profit' : summary.profit < 0 ? 'loss' : 'neutral'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <p className="text-sm text-muted-foreground">
          Período: {data.rangeLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          {DASHBOARD_PERIODS.map((period) => (
            <Button
              key={period}
              variant={data.period === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(period)}
            >
              {dashboardPeriodLabels[period]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card className={cn(resultTone === 'profit' && 'border-green-500/30 bg-green-500/5', resultTone === 'loss' && 'border-red-500/30 bg-red-500/5')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {summary.profit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              Resultado neto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold tabular-nums', summary.profit >= 0 ? 'text-green-700' : summary.profit < 0 ? 'text-red-700' : '')}>
              {formatTripCurrency(summary.profit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Resultado de viajes (ingresos − gastos de viaje)
            </p>
            {comparison && (
              <div className="mt-2 space-y-1">
                <DeltaBadge value={comparison.profitDelta} />
                <p className="text-[11px] text-muted-foreground">{comparison.label}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-green-700">
              {formatTripCurrency(summary.income)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Suma de importes a cobrar en {summary.tripCount} viaje{summary.tripCount === 1 ? '' : 's'}
            </p>
            {comparison && (
              <div className="mt-2">
                <DeltaBadge value={comparison.incomeDelta} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Egresos viajes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-red-700">
              {formatTripCurrency(summary.expenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gastos registrados en viajes del período
            </p>
          </CardContent>
        </Card>

        {INVENTORY_ENABLED && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Compras operativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums text-red-700">
                {formatTripCurrency(summary.operationalPurchases)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Insumos e inventario (compras registradas)
              </p>
              {comparison && (
                <div className="mt-2">
                  <DeltaBadge value={comparison.operationalPurchasesDelta} />
                </div>
              )}
              <Button variant="link" className="px-0 h-auto mt-1 text-xs" asChild>
                <Link href="/app/inventario">Ver inventario</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Margen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatTripMargin(summary.marginPercent) ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Resultado sobre ingresos del período
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Evolución mensual</CardTitle>
            <CardDescription>
              Ingresos, egresos de viaje{INVENTORY_ENABLED ? ', compras operativas' : ''} y resultado por mes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No hay viajes en este período.
              </p>
            ) : (
              <ChartContainer config={chartConfig} className="aspect-[16/9] w-full">
                <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCompactCurrency(Number(value))}
                    width={56}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <span className="font-medium tabular-nums">
                            {chartConfig[name as keyof typeof chartConfig]?.label}:{' '}
                            {formatTripCurrency(Number(value))}
                          </span>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
                  {INVENTORY_ENABLED && (
                    <Bar dataKey="operationalPurchases" fill="var(--color-operationalPurchases)" radius={[4, 4, 0, 0]} />
                  )}
                  <Bar dataKey="profit" fill="var(--color-profit)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Cobranza
            </CardTitle>
            <CardDescription>Qué entró y qué falta cobrar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {INVENTORY_ENABLED && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Stock bajo / sin stock</p>
                <p className={cn('text-lg font-semibold tabular-nums', summary.lowStockItems > 0 ? 'text-amber-700' : '')}>
                  {summary.lowStockItems} ítem{summary.lowStockItems === 1 ? '' : 's'}
                </p>
                <Button variant="link" className="px-0 h-auto mt-1 text-xs" asChild>
                  <Link href="/app/inventario">Ver inventario</Link>
                </Button>
              </div>
            )}
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Cobrado en el período</p>
              <p className="text-lg font-semibold tabular-nums text-green-700">
                {formatTripCurrency(summary.paidAmount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.paidTrips} viaje{summary.paidTrips === 1 ? '' : 's'} pagados
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Pendiente de cobro (viajes)</p>
              <p className="text-lg font-semibold tabular-nums text-amber-700">
                {formatTripCurrency(summary.pendingPaymentAmount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.pendingPaymentTrips} viaje{summary.pendingPaymentTrips === 1 ? '' : 's'} en pendiente de pago
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Proformas pendientes</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatTripCurrency(summary.pendingProformasAmount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.pendingProformas} proforma{summary.pendingProformas === 1 ? '' : 's'} sin cobrar
              </p>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/app/proformas">Ver proformas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Detalle por mes</CardTitle>
            <CardDescription>Desglose mes a mes del período seleccionado</CardDescription>
          </CardHeader>
          <CardContent>
            {monthly.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sin datos en el período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">Viajes</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Egresos viajes</TableHead>
                    {INVENTORY_ENABLED && (
                      <TableHead className="text-right">Compras</TableHead>
                    )}
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthly.map((month) => {
                    const margin = month.income > 0 ? (month.profit / month.income) * 100 : null
                    return (
                      <TableRow key={month.key}>
                        <TableCell className="font-medium capitalize">{month.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{month.tripCount}</TableCell>
                        <TableCell className="text-right tabular-nums text-green-700">
                          {formatTripCurrency(month.income)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-red-700">
                          {formatTripCurrency(month.expenses)}
                        </TableCell>
                        {INVENTORY_ENABLED && (
                          <TableCell className="text-right tabular-nums text-red-700">
                            {formatTripCurrency(month.operationalPurchases)}
                          </TableCell>
                        )}
                        <TableCell className={cn('text-right tabular-nums font-medium', month.profit >= 0 ? 'text-green-700' : 'text-red-700')}>
                          {formatTripCurrency(month.profit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTripMargin(margin) ?? '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              Viajes del período
            </CardTitle>
            <CardDescription>Rentabilidad de la operación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm">Total viajes</span>
              <div className="text-right">
                <span className="font-semibold tabular-nums">{summary.tripCount}</span>
                {comparison && (
                  <div>
                    <DeltaBadge value={comparison.tripCountDelta} format="number" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm">Con ganancia</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-800 border-green-500/30">
                {summary.profitableTrips}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm">Con pérdida</span>
              <Badge variant="outline" className="bg-red-500/10 text-red-800 border-red-500/30">
                {summary.lossTrips}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm">Sin ingreso cargado</span>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-800 border-amber-500/30">
                {summary.pendingIncomeTrips}
              </Badge>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/app/viajes">Ver viajes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
