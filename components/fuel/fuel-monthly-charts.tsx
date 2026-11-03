'use client'

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { FuelMonthRow } from '@/lib/fuel/report'
import { formatArs, formatLiters, formatPricePerLiter } from '@/components/fuel/format'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const short = (key: string) => {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}

const compactArs = (n: number) =>
  new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

const amountConfig = { amount: { label: 'Pagado', color: 'var(--chart-1)' } } satisfies ChartConfig
const priceConfig = { avgPricePerLiter: { label: '$ por litro', color: 'var(--chart-1)' } } satisfies ChartConfig

/** Dos gráficos de una sola medida cada uno: pesos por mes y precio por litro por mes. */
export function FuelMonthlyCharts({ rows }: { rows: FuelMonthRow[] }) {
  const data = rows.map((r) => ({ ...r, label: short(r.month) }))
  const hasData = rows.some((r) => r.loads > 0)

  if (!hasData) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay cargas para graficar.</p>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-medium">Pesos pagados por mes</p>
        <ChartContainer config={amountConfig} className="aspect-[16/9] w-full">
          <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => compactArs(Number(v))} />
            <ChartTooltip
              cursor={{ fillOpacity: 0.3 }}
              content={
                <ChartTooltipContent
                  hideIndicator
                  formatter={(_, __, item) => {
                    const r = item.payload as FuelMonthRow
                    return (
                      <div className="grid gap-0.5 tabular-nums">
                        <span className="font-medium">{formatArs(r.amount)}</span>
                        <span className="text-muted-foreground">
                          {formatLiters(r.liters)} · {r.loads} cargas
                          {r.pendingPriceLoads > 0 ? ` · ${r.pendingPriceLoads} sin precio` : ''}
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ChartContainer>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Precio promedio por litro</p>
        <ChartContainer config={priceConfig} className="aspect-[16/9] w-full">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              domain={['auto', 'auto']}
              tickFormatter={(v) => `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideIndicator
                  formatter={(value) => (
                    <span className="font-medium tabular-nums">{formatPricePerLiter(Number(value))} por litro</span>
                  )}
                />
              }
            />
            <Line
              dataKey="avgPricePerLiter"
              type="monotone"
              stroke="var(--color-avgPricePerLiter)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  )
}
