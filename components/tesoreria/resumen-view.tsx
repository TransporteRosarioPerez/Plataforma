'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Scale, User } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AccountBalance, MonthTotal, ScopeFilter, TreasurySummary } from '@/lib/tesoreria/summary'
import type { ChequeOutlook } from '@/lib/tesoreria/cheques'
import { formatDate, formatMoney, formatMoneyCompact, formatMonth } from './format'

const chartConfig = {
  income: { label: 'Ingresos', color: 'var(--chart-2)' },
  expense: { label: 'Egresos', color: 'var(--chart-1)' },
} satisfies ChartConfig

type Props = {
  month: string
  scope: ScopeFilter
  availableMonths: string[]
  summary: TreasurySummary
  chart: MonthTotal[]
  balances: AccountBalance[]
  hasData: boolean
  cheques: ChequeOutlook
}

export function ResumenView({ month, scope, availableMonths, summary, chart, balances, hasData, cheques }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/app/tesoreria?${params.toString()}`)
  }

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Todavía no hay movimientos</CardTitle>
          <CardDescription>
            Empezá importando un extracto de Macro o Nación. El sistema lo categoriza solo y deja en
            Pendientes lo que no pudo deducir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/app/tesoreria/importar">Importar extracto</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const income = summary.byCategory.filter((c) => c.total >= 0)
  const expense = summary.byCategory.filter((c) => c.total < 0)
  const months = availableMonths.includes(month) ? availableMonths : [...availableMonths, month].sort()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onValueChange={(v) => setParam('mes', v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...months].reverse().map((m) => (
              <SelectItem key={m} value={m} className="capitalize">
                {formatMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          value={scope}
          onValueChange={(v) => v && setParam('ambito', v)}
        >
          <ToggleGroupItem value="todo" className="px-4">Todo</ToggleGroupItem>
          <ToggleGroupItem value="empresa" className="px-4">Empresa</ToggleGroupItem>
          <ToggleGroupItem value="personal" className="px-4">Personal</ToggleGroupItem>
        </ToggleGroup>
        {summary.pendingCount > 0 && (
          <Link
            href="/app/tesoreria/pendientes"
            className="ml-auto flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          >
            <AlertTriangle className="h-4 w-4" />
            {summary.pendingCount} movimiento{summary.pendingCount === 1 ? '' : 's'} sin clasificar este mes
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<ArrowDownLeft className="h-4 w-4" />} title="Ingresos" value={summary.income} tone="text-green-700 dark:text-green-400" />
        <Kpi icon={<ArrowUpRight className="h-4 w-4" />} title="Egresos" value={summary.expense} />
        <Kpi
          icon={<Scale className="h-4 w-4" />}
          title="Resultado"
          value={summary.net}
          tone={summary.net >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              Gastos personales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatMoney(summary.personalExpense)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.personalShareOfIncome === null
                ? 'Sin ingresos en el período'
                : `${(summary.personalShareOfIncome * 100).toFixed(1)}% de lo que entró`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Últimos 6 meses</CardTitle>
            <CardDescription>Sin transferencias internas</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
              <BarChart data={chart.map((m) => ({ ...m, label: formatMonth(m.month) }))} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v) => formatMoneyCompact(Number(v))} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span className="font-medium tabular-nums">
                          {chartConfig[name as keyof typeof chartConfig]?.label}: {formatMoney(Number(value))}
                        </span>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saldos por cuenta</CardTitle>
            <CardDescription>Sistema vs. último saldo informado por el banco</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {balances.map((b) => {
              const diff = b.lastBankBalance === null ? null : b.systemBalance - b.lastBankBalance
              return (
                <div key={b.accountId} className="rounded-lg border p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{b.name}</span>
                    <span className="font-semibold tabular-nums">{formatMoney(b.systemBalance)}</span>
                  </div>
                  {b.lastBankBalance !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Banco al {formatDate(b.lastBankBalanceDate)}: {formatMoney(b.lastBankBalance)}
                      {diff !== null && Math.abs(diff) > 0.01 && (
                        <span className="ml-1 font-medium text-amber-700 dark:text-amber-400">
                          · diferencia {formatMoney(diff)} (revisá el saldo inicial en Configuración)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )
            })}
            {cheques.pendingCount > 0 && (
              <Link href="/app/tesoreria/cheques" className="block rounded-lg border border-blue-200 bg-blue-50/60 p-3 hover:bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">Cheques por debitar</span>
                  <span className="font-semibold tabular-nums">-{formatMoney(cheques.pendingAmount)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cheques.pendingCount} cheque{cheques.pendingCount === 1 ? '' : 's'} · {formatMoney(cheques.next7Amount)} en los próximos 7 días
                  {cheques.overdueCount > 0 && ` · ${cheques.overdueCount} con fecha vencida`}
                </p>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryTable title="Ingresos por categoría" rows={income} month={month} />
        <CategoryTable title="Egresos por categoría" rows={expense} month={month} />
      </div>
    </div>
  )
}

function Kpi({ icon, title, value, tone }: { icon: React.ReactNode; title: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold tabular-nums ${tone ?? ''}`}>{formatMoney(value)}</div>
      </CardContent>
    </Card>
  )
}

function CategoryTable({
  title,
  rows,
  month,
}: {
  title: string
  rows: TreasurySummary['byCategory']
  month: string
}) {
  const total = rows.reduce((acc, r) => acc + Math.abs(r.total), 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin movimientos</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="w-16 text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const [y, m] = month.split('-')
                const last = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate()
                const href = `/app/tesoreria/movimientos?desde=${month}-01&hasta=${month}-${last}&categoria=${r.categoryId ?? 'none'}`
                return (
                  <TableRow key={`${r.name}-${r.kind}`}>
                    <TableCell>
                      <Link href={href} className={r.kind === 'unclassified' ? 'text-amber-700 hover:underline dark:text-amber-400' : 'hover:underline'}>
                        {r.name}
                      </Link>
                      <span className="ml-1 text-xs text-muted-foreground">({r.count})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(Math.abs(r.total))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {total ? ((Math.abs(r.total) / total) * 100).toFixed(0) : 0}%
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
