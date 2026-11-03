'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Briefcase, Wallet } from 'lucide-react'
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
import type { CashPosition, MonthlyProfit } from '@/lib/tesoreria/monthly'
import { formatDate, formatMoney, formatMoneyCompact, formatMonth } from './format'

const chartConfig = {
  income: { label: 'Entró', color: 'var(--chart-2)' },
  expense: { label: 'Salió', color: 'var(--chart-1)' },
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
  cash: CashPosition
  profit: MonthlyProfit
}

export function ResumenView({ month, scope, availableMonths, summary, chart, balances, hasData, cheques, cash, profit }: Props) {
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

      <div className="grid gap-4 lg:grid-cols-2">
        <CashCard cash={cash} />
        <ProfitCard profit={profit} />
      </div>

      <CashByAccount cash={cash} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Plata que entró y salió · últimos 6 meses</CardTitle>
            <CardDescription>Sin transferencias entre cuentas propias. No es ganancia: es movimiento de plata.</CardDescription>
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

function money(n: number) {
  return <span className={n < 0 ? 'text-red-700 dark:text-red-400' : ''}>{formatMoney(n)}</span>
}

function Line({ label, hint, value, sign, strong }: { label: string; hint?: string; value: number; sign?: '+' | '−' | '±'; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? 'border-t pt-3 text-base font-semibold' : 'text-sm'}`}>
      <div>
        <span>{sign && <span className="mr-1 inline-block w-3 text-muted-foreground">{sign}</span>}{label}</span>
        {hint && <p className={`text-xs font-normal text-muted-foreground ${sign ? 'ml-4' : ''}`}>{hint}</p>}
      </div>
      <span className="shrink-0 tabular-nums">{sign === '−' ? formatMoney(value) : money(value)}</span>
    </div>
  )
}

function CashCard({ cash }: { cash: CashPosition }) {
  const delta = cash.end - cash.start
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-muted-foreground" />¿Cuánta plata hay?</CardTitle>
        <CardDescription>Todas las cuentas juntas: lo que había, lo que entró, lo que salió y lo que quedó.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Line label={`Al empezar el mes (${formatDate(cash.startDate)})`} value={cash.start} />
        <Line sign="+" label="Entró" value={cash.inflow} />
        <Line sign="−" label="Salió" value={cash.outflow} />
        {Math.abs(cash.otherAccounts) >= 1 && (
          <Line
            sign="±"
            label="Fue o vino de otras cuentas propias"
            hint="Cuentas que no están en Tesorería (por ejemplo, «compensación entre tus cuentas»)"
            value={cash.otherAccounts}
          />
        )}
        <Line strong label={`Al ${formatDate(cash.endDate)}`} value={cash.end} />
        <p className={`rounded-md px-3 py-2 text-sm ${delta >= 0 ? 'bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100' : 'bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100'}`}>
          En el mes la plata en las cuentas {delta >= 0 ? 'subió' : 'bajó'} <strong className="tabular-nums">{formatMoney(Math.abs(delta))}</strong>
          {cash.start < 0 && cash.end > cash.start && ' (parte se usó para cubrir el descubierto con que arrancó el mes)'}.
        </p>
        {cash.skippedAccounts.length > 0 && (
          <p className="text-xs text-muted-foreground">
            No incluye {cash.skippedAccounts.join(', ')}: su saldo inicial empieza después de este mes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function CashByAccount({ cash }: { cash: CashPosition }) {
  const cell = (n: number, strong = false) => (
    <TableCell className={`text-right tabular-nums ${strong ? 'font-semibold' : ''} ${n < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
      {Math.abs(n) < 0.005 ? '—' : formatMoney(n)}
    </TableCell>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>¿En qué cuenta estaba la plata?</CardTitle>
        <CardDescription>
          Cada cuenta del {formatDate(cash.startDate)} al {formatDate(cash.endDate)}. «Entre cuentas propias» es plata que pasó
          de una cuenta a otra: no es ingreso ni gasto, y en el total se compensa (salvo lo que fue a cuentas que no están cargadas).
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead className="text-right">Al empezar</TableHead>
              <TableHead className="text-right">+ Entró</TableHead>
              <TableHead className="text-right">− Salió</TableHead>
              <TableHead className="text-right">± Entre cuentas propias</TableHead>
              <TableHead className="text-right">Al terminar</TableHead>
              <TableHead className="text-right">Cambio en el mes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cash.byAccount.map((r) => (
              <TableRow key={r.accountId}>
                <TableCell className="font-medium">{r.name}</TableCell>
                {cell(r.start)}
                {cell(r.inflow)}
                {cell(-r.outflow)}
                {cell(r.transfers)}
                {cell(r.end, true)}
                {cell(r.end - r.start)}
              </TableRow>
            ))}
            <TableRow className="border-t-2 font-semibold">
              <TableCell>Total</TableCell>
              {cell(cash.start, true)}
              {cell(cash.inflow, true)}
              {cell(-cash.outflow, true)}
              {cell(cash.otherAccounts, true)}
              {cell(cash.end, true)}
              {cell(cash.end - cash.start, true)}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ProfitCard({ profit }: { profit: MonthlyProfit }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-muted-foreground" />¿Se ganó plata trabajando?</CardTitle>
        <CardDescription>Lo que se facturó en el mes menos lo que costó. Es aproximado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Line
          label="Facturado en el mes"
          hint={`${profit.invoiceCount} factura${profit.invoiceCount === 1 ? '' : 's'}, con IVA · sección Facturas`}
          value={profit.invoiced}
        />
        <Line
          sign="−"
          label="Gastos de la empresa"
          hint={profit.committedChequeCount > 0 ? `Incluye ${profit.committedChequeCount} cheque${profit.committedChequeCount === 1 ? '' : 's'} firmado${profit.committedChequeCount === 1 ? '' : 's'} y todavía no debitado${profit.committedChequeCount === 1 ? '' : 's'} (${formatMoney(profit.committedCheques)})` : undefined}
          value={profit.expenses}
        />
        <Line strong label="Ganancia aproximada" value={profit.profit} />

        <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Aparte, no entra en la cuenta:</p>
          <p>Gastos personales: <span className="tabular-nums">{formatMoney(profit.personalExpenses)}</span></p>
          {profit.loanPayments > 0 && (
            <p>Cuotas de préstamos: <span className="tabular-nums">{formatMoney(profit.loanPayments)}</span> (devolver un préstamo no es un gasto; los intereses sí cuentan)</p>
          )}
        </div>

        {profit.invoiceCount === 0 && (
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">No hay facturas cargadas con fecha de este mes: la ganancia no va a ser real hasta cargarlas.</p>
        )}
        {profit.unclassifiedCount > 0 && (
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Incluye {profit.unclassifiedCount} gasto{profit.unclassifiedCount === 1 ? '' : 's'} sin clasificar ({formatMoney(profit.unclassifiedAmount)}). Clasificalos en Pendientes: si alguno es personal o interno, la ganancia cambia.
          </p>
        )}
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          <li>La tarjeta de crédito cuenta en el mes en que se paga el resumen.</li>
          <li>Los cheques cuentan en el mes en que se firman, si están registrados en Cheques.</li>
        </ul>
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
