'use client'

import Link from 'next/link'
import { Route, ShoppingCart, TrendingDown, TrendingUp } from 'lucide-react'
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
import type { DashboardKpiData } from '@/lib/data/dashboard-kpis'
import { INVENTORY_ENABLED } from '@/lib/features'
import { formatTripCurrency, formatTripMargin } from '@/lib/trip-economics'
import { cn } from '@/lib/utils'
import { DeltaBadge, formatCompactCurrency } from '@/components/reportes/reportes-shared'

const chartConfig = {
  income: {
    label: 'Ingresos a cobrar',
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

type ReportesOperativoSectionProps = {
  data: DashboardKpiData
}

export function ReportesOperativoSection({ data }: ReportesOperativoSectionProps) {
  const { summary, monthly, comparison } = data

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
      <p className="text-sm text-muted-foreground">
        Rentabilidad por viaje según fecha de salida. No refleja cuándo se facturó o cobró.
      </p>

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
              Ingresos a cobrar − gastos de viaje del período
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos a cobrar (neto)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-green-700">
              {formatTripCurrency(summary.income)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Importes de proforma en {summary.tripCount} viaje{summary.tripCount === 1 ? '' : 's'}
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
              Resultado sobre ingresos a cobrar del período
            </p>
          </CardContent>
        </Card>

        {INVENTORY_ENABLED && summary.lowStockItems > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Stock bajo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums text-amber-700">
                {summary.lowStockItems}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ítems bajo mínimo</p>
              <Button variant="link" className="px-0 h-auto mt-1 text-xs" asChild>
                <Link href="/app/inventario">Ver inventario</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Evolución mensual</CardTitle>
            <CardDescription>
              Ingresos a cobrar, egresos de viaje{INVENTORY_ENABLED ? ', compras operativas' : ''} y resultado por mes
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
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
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

      <Card>
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
                  <TableHead className="text-right">Ingresos a cobrar</TableHead>
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
    </div>
  )
}
