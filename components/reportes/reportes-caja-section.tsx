'use client'

import Link from 'next/link'
import { FileText, Receipt, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import type { CashKpiData } from '@/lib/data/cash-kpis'
import { formatTripCurrency } from '@/lib/trip-economics'
import { DeltaBadge, formatCompactCurrency, formatReportDate } from '@/components/reportes/reportes-shared'

const chartConfig = {
  invoicedNet: {
    label: 'Facturado (neto)',
    color: 'var(--chart-2)',
  },
  collectedNet: {
    label: 'Cobrado (neto)',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig

type ReportesCajaSectionProps = {
  data: CashKpiData
}

export function ReportesCajaSection({ data }: ReportesCajaSectionProps) {
  const { summary, monthly, comparison, collectionBridge } = data

  const chartData = monthly.map((month) => ({
    month: month.label,
    invoicedNet: month.invoicedNet,
    collectedNet: month.collectedNet,
  }))

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Flujo de facturación y cobro según fechas de emisión y pago de facturas.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Facturado (neto)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-blue-700">
              {formatTripCurrency(summary.invoicedNet)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.invoiceCount} factura{summary.invoiceCount === 1 ? '' : 's'} emitida{summary.invoiceCount === 1 ? '' : 's'} en el período
            </p>
            {comparison && (
              <div className="mt-2 space-y-1">
                <DeltaBadge value={comparison.invoicedNetDelta} />
                <p className="text-[11px] text-muted-foreground">{comparison.label}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Facturado (total c/IVA)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-blue-700">
              {formatTripCurrency(summary.invoicedGross)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Por fecha de emisión</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Cobrado (neto)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-green-700">
              {formatTripCurrency(summary.collectedNet)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.collectedCount} factura{summary.collectedCount === 1 ? '' : 's'} cobrada{summary.collectedCount === 1 ? '' : 's'} en el período
            </p>
            {comparison && (
              <div className="mt-2">
                <DeltaBadge value={comparison.collectedNetDelta} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cobrado (total c/IVA)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-green-700">
              {formatTripCurrency(summary.collectedGross)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Por fecha de cobro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">IVA cobrado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatTripCurrency(summary.collectedIva)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">IVA de facturas cobradas en el período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">A facturar (proformas)</p>
              <p className="font-semibold tabular-nums">{formatTripCurrency(summary.pendingToInvoiceAmount)}</p>
              <p className="text-xs text-muted-foreground">{summary.pendingToInvoiceCount} proforma{summary.pendingToInvoiceCount === 1 ? '' : 's'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A cobrar (facturas emitidas)</p>
              <p className="font-semibold tabular-nums text-amber-700">{formatTripCurrency(summary.pendingToCollectNet)}</p>
              <p className="text-xs text-muted-foreground">{summary.pendingToCollectCount} factura{summary.pendingToCollectCount === 1 ? '' : 's'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Evolución mensual</CardTitle>
            <CardDescription>Facturado por emisión y cobrado por fecha de pago</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No hay facturas en este período.
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
                  <Bar dataKey="invoicedNet" fill="var(--color-invoicedNet)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collectedNet" fill="var(--color-collectedNet)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accesos rápidos</CardTitle>
            <CardDescription>Gestión de facturación y cobro</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/app/facturas">Ver facturas</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/app/proformas">Ver proformas</Link>
            </Button>
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p className="text-xs text-muted-foreground">Total a cobrar (con IVA)</p>
              <p className="text-lg font-semibold tabular-nums text-amber-700">
                {formatTripCurrency(summary.pendingToCollectGross)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por mes</CardTitle>
          <CardDescription>Facturado y cobrado mes a mes</CardDescription>
        </CardHeader>
        <CardContent>
          {monthly.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin datos en el período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Fact. neto</TableHead>
                  <TableHead className="text-right">Fact. total</TableHead>
                  <TableHead className="text-right">Cobrado neto</TableHead>
                  <TableHead className="text-right">Cobrado total</TableHead>
                  <TableHead className="text-right">IVA cobrado</TableHead>
                  <TableHead className="text-right">Nº facturas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthly.map((month) => (
                  <TableRow key={month.key}>
                    <TableCell className="font-medium capitalize">{month.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-blue-700">
                      {formatTripCurrency(month.invoicedNet)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-blue-700">
                      {formatTripCurrency(month.invoicedGross)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-green-700">
                      {formatTripCurrency(month.collectedNet)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-green-700">
                      {formatTripCurrency(month.collectedGross)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTripCurrency(month.collectedIva)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {month.invoiceCount} / {month.collectedCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {collectionBridge.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cobros del período por viaje</CardTitle>
            <CardDescription>
              Desfase entre fecha del viaje y fecha de cobro de la factura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Viaje</TableHead>
                  <TableHead>Salida viaje</TableHead>
                  <TableHead>Cobro</TableHead>
                  <TableHead className="text-right">Neto factura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collectionBridge.map((row) => (
                  <TableRow key={`${row.invoiceId}-${row.tripId}`}>
                    <TableCell className="font-mono text-sm">{row.invoiceNumber}</TableCell>
                    <TableCell>
                      <Link href={`/app/viajes/${row.tripId}`} className="font-mono hover:underline">
                        {row.tripCode}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatReportDate(row.tripDepartureDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatReportDate(row.paidDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTripCurrency(row.collectedNet)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
