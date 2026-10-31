'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronDown, ChevronRight, Pencil, Plus, Trash2, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { deleteForecastItem, upsertForecastItem } from '@/lib/tesoreria/server/actions-forecast'
import {
  chequeOccurrences,
  expandForecastItems,
  weeklyProjection,
  type ForecastFrequency,
  type ForecastItem,
} from '@/lib/tesoreria/forecast'
import type { AccountBalance } from '@/lib/tesoreria/summary'
import type { TreasuryAccount, TreasuryCategory, TreasuryCheque } from '@/lib/tesoreria/types'
import { cn } from '@/lib/utils'
import { formatDate, formatMoney } from './format'

export type ForecastSuggestion = { categoryId: string; name: string; monthlyAverage: number }

const ALL = '__all'
const NONE = '__none'
const WEEKS = 8
const frequencyLabels: Record<ForecastFrequency, string> = { once: 'Una vez', weekly: 'Semanal', monthly: 'Mensual' }

type Draft = {
  id?: string
  name: string
  direction: 'out' | 'in'
  amount: number | undefined
  frequency: ForecastFrequency
  startDate: string
  endDate: string
  dayOfMonth: number | undefined
  accountId: string
  categoryId: string
  isActive: boolean
}

type Props = {
  accounts: TreasuryAccount[]
  categories: TreasuryCategory[]
  balances: AccountBalance[]
  cheques: TreasuryCheque[]
  items: ForecastItem[]
  suggestions: ForecastSuggestion[]
  today: string
}

export function ProyeccionView({ accounts, categories, balances, cheques, items, suggestions, today }: Props) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [accountFilter, setAccountFilter] = useState<string>(ALL)
  const [includeCash, setIncludeCash] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState<Draft | null>(null)
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  const scopeAccounts = balances.filter((b) =>
    accountFilter === ALL ? includeCash || b.kind !== 'cash' : b.accountId === accountFilter
  )
  const startBalance = scopeAccounts.reduce((a, b) => a + b.systemBalance, 0)

  const projection = useMemo(() => {
    const end = new Date(`${today}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() + WEEKS * 7)
    const occurrences = [
      ...expandForecastItems(items, today, end.toISOString().slice(0, 10)),
      ...chequeOccurrences(cheques, today),
    ].filter((o) => {
      if (accountFilter !== ALL) return o.accountId === accountFilter
      // Consolidado: los ítems sin cuenta cuentan; los de efectivo sólo si se incluye el efectivo.
      const kind = accounts.find((a) => a.id === o.accountId)?.kind
      return includeCash || kind !== 'cash'
    })
    return weeklyProjection({ startBalance, today, weeks: WEEKS, occurrences })
  }, [items, cheques, today, accountFilter, includeCash, startBalance, accounts])

  const run = (fn: () => Promise<{ error?: string; success?: string }>, onOk?: () => void) =>
    startTransition(async () => {
      const r = await fn()
      if (r.error) toast.error(r.error)
      else {
        toast.success(r.success)
        onOk?.()
        router.refresh()
      }
    })

  const emptyDraft = (patch: Partial<Draft> = {}): Draft => ({
    name: '',
    direction: 'out',
    amount: undefined,
    frequency: 'monthly',
    startDate: today,
    endDate: '',
    dayOfMonth: undefined,
    accountId: accountFilter !== ALL ? accountFilter : '',
    categoryId: '',
    isActive: true,
    ...patch,
  })

  const save = (d: Draft) => {
    if (!d.name.trim()) return toast.error('Poné un nombre')
    if (!d.amount) return toast.error('Poné el monto')
    run(
      () =>
        upsertForecastItem({
          id: d.id,
          name: d.name,
          amount: d.direction === 'out' ? -Math.abs(d.amount!) : Math.abs(d.amount!),
          frequency: d.frequency,
          startDate: d.startDate,
          endDate: d.endDate || null,
          dayOfMonth: d.frequency === 'monthly' ? d.dayOfMonth ?? null : null,
          accountId: d.accountId || null,
          categoryId: d.categoryId || null,
          isActive: d.isActive,
          notes: null,
        }),
      () => setDraft(null)
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las cuentas</SelectItem>
            {accounts.filter((a) => a.isActive).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {accountFilter === ALL && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={includeCash} onCheckedChange={setIncludeCash} /> Incluir efectivo
          </label>
        )}
        <Button className="ml-auto" onClick={() => setDraft(emptyDraft())}>
          <Plus className="mr-2 h-4 w-4" />Agregar ingreso o gasto esperado
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Saldo hoy</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums">{formatMoney(startBalance)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><TrendingDown className="h-4 w-4" />Punto más bajo (8 semanas)</CardTitle></CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold tabular-nums', projection.lowestBalance < 0 && 'text-red-700 dark:text-red-400')}>
              {formatMoney(projection.lowestBalance)}
            </div>
            {projection.lowestWeekStart && <p className="mt-1 text-xs text-muted-foreground">semana del {formatDate(projection.lowestWeekStart)}</p>}
          </CardContent>
        </Card>
        <Card className={projection.firstNegativeWeekStart ? 'border-red-300 dark:border-red-900' : undefined}>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><AlertTriangle className="h-4 w-4" />Descubierto</CardTitle></CardHeader>
          <CardContent>
            {projection.firstNegativeWeekStart ? (
              <>
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">Semana del {formatDate(projection.firstNegativeWeekStart)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Hay que cubrirlo antes: mover plata, adelantar cobros o pasar pagos.</p>
              </>
            ) : (
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">No se ve en 8 semanas</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Semana por semana</CardTitle>
          <CardDescription>
            Incluye los cheques emitidos que todavía no se debitaron (los vencidos caen en esta semana) y los ingresos y gastos esperados de abajo.
            Es una estimación: sólo sabe lo que está cargado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Semana</TableHead>
                <TableHead className="text-right">Saldo inicial</TableHead>
                <TableHead className="text-right">Entra</TableHead>
                <TableHead className="text-right">Sale</TableHead>
                <TableHead className="text-right">Saldo final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projection.weeks.map((w) => {
                const expanded = open.has(w.start)
                return (
                  <Fragment key={w.start}>
                    <TableRow
                      className={cn(w.occurrences.length > 0 && 'cursor-pointer')}
                      onClick={() => {
                        if (!w.occurrences.length) return
                        const next = new Set(open)
                        if (expanded) next.delete(w.start)
                        else next.add(w.start)
                        setOpen(next)
                      }}
                    >
                      <TableCell>{w.occurrences.length > 0 && (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(w.start)} – {formatDate(w.end)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(w.opening)}</TableCell>
                      <TableCell className="text-right tabular-nums text-green-700 dark:text-green-400">{w.inflow ? formatMoney(w.inflow) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{w.outflow ? formatMoney(-w.outflow) : '—'}</TableCell>
                      <TableCell className={cn('text-right font-semibold tabular-nums', w.closing < 0 && 'text-red-700 dark:text-red-400')}>{formatMoney(w.closing)}</TableCell>
                    </TableRow>
                    {expanded &&
                      w.occurrences.map((o, i) => (
                        <TableRow key={`${w.start}-${o.refId}-${i}`} className="bg-muted/30 text-sm">
                          <TableCell />
                          <TableCell className="pl-6 text-muted-foreground">{formatDate(o.date)}</TableCell>
                          <TableCell colSpan={2}>
                            {o.label}
                            {o.kind === 'cheque' && <Badge variant="outline" className="ml-2">Cheque</Badge>}
                            {o.accountId && <span className="ml-2 text-xs text-muted-foreground">{accountName.get(o.accountId)}</span>}
                          </TableCell>
                          <TableCell colSpan={2} className={cn('text-right tabular-nums', o.amount > 0 && 'text-green-700 dark:text-green-400')}>{formatMoney(o.amount)}</TableCell>
                        </TableRow>
                      ))}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sugerencias según los últimos 3 meses</CardTitle>
            <CardDescription>Categorías que se repitieron todos los meses. Agregalas como mensuales y ajustá el monto si hace falta.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button
                key={s.categoryId}
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft(
                    emptyDraft({
                      name: s.name,
                      direction: s.monthlyAverage < 0 ? 'out' : 'in',
                      amount: Math.abs(s.monthlyAverage),
                      categoryId: s.categoryId,
                    })
                  )
                }
              >
                <Plus className="mr-1 h-3 w-3" />{s.name} · {formatMoney(s.monthlyAverage)}/mes
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ingresos y gastos esperados</CardTitle>
          <CardDescription>Sueldos, seguros, servicios, cuotas, cobros que se esperan… Los cheques emitidos se toman solos del registro.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead>Frecuencia</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Todavía no cargaste ingresos ni gastos esperados</TableCell></TableRow>
              )}
              {items.map((it) => (
                <TableRow key={it.id} className={it.isActive ? undefined : 'opacity-50'}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell>
                    {frequencyLabels[it.frequency]}
                    {it.frequency === 'monthly' && it.dayOfMonth && <span className="text-muted-foreground"> · día {it.dayOfMonth}</span>}
                  </TableCell>
                  <TableCell>{formatDate(it.startDate)}{it.endDate && ` → ${formatDate(it.endDate)}`}</TableCell>
                  <TableCell>{it.accountId ? accountName.get(it.accountId) : 'Sin cuenta'}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', it.amount > 0 && 'text-green-700 dark:text-green-400')}>{formatMoney(it.amount)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setDraft({
                            id: it.id,
                            name: it.name,
                            direction: it.amount < 0 ? 'out' : 'in',
                            amount: Math.abs(it.amount),
                            frequency: it.frequency,
                            startDate: it.startDate,
                            endDate: it.endDate ?? '',
                            dayOfMonth: it.dayOfMonth ?? undefined,
                            accountId: it.accountId ?? '',
                            categoryId: it.categoryId ?? '',
                            isActive: it.isActive,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        onClick={() => window.confirm(`¿Enviar "${it.name}" a la papelera?`) && run(() => deleteForecastItem(it.id))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle>{draft.id ? 'Editar' : 'Agregar'} ingreso o gasto esperado</DialogTitle>
                <DialogDescription>Se usa sólo para proyectar; no crea movimientos.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <ToggleGroup type="single" variant="outline" value={draft.direction} onValueChange={(v) => v && setDraft({ ...draft, direction: v as 'in' | 'out' })} className="w-full">
                  <ToggleGroupItem value="out" className="flex-1">Sale</ToggleGroupItem>
                  <ToggleGroupItem value="in" className="flex-1">Entra</ToggleGroupItem>
                </ToggleGroup>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Concepto</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej.: Sueldos" autoFocus /></div>
                  <div className="space-y-2"><Label>Monto</Label><NumberInput decimals={2} value={draft.amount} onValueChange={(v) => setDraft({ ...draft, amount: v })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Frecuencia</Label>
                    <Select value={draft.frequency} onValueChange={(v) => setDraft({ ...draft, frequency: v as ForecastFrequency })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(frequencyLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {draft.frequency === 'monthly' ? (
                    <div className="space-y-2">
                      <Label>Día del mes</Label>
                      <Input type="number" min={1} max={31} value={draft.dayOfMonth ?? ''} onChange={(e) => setDraft({ ...draft, dayOfMonth: e.target.value ? Number(e.target.value) : undefined })} placeholder={draft.startDate.slice(8, 10)} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>{draft.frequency === 'once' ? 'Fecha' : 'Desde'}</Label>
                      <Input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
                    </div>
                  )}
                </div>
                {draft.frequency !== 'once' && (
                  <div className="grid grid-cols-2 gap-3">
                    {draft.frequency === 'monthly' && (
                      <div className="space-y-2"><Label>Desde</Label><Input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></div>
                    )}
                    <div className="space-y-2"><Label>Hasta (opcional)</Label><Input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cuenta</Label>
                    <Select value={draft.accountId || NONE} onValueChange={(v) => setDraft({ ...draft, accountId: v === NONE ? '' : v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin cuenta</SelectItem>
                        {accounts.filter((a) => a.isActive).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select value={draft.categoryId || NONE} onValueChange={(v) => setDraft({ ...draft, categoryId: v === NONE ? '' : v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin categoría</SelectItem>
                        {categories.filter((c) => c.isActive && c.kind !== 'internal').map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} /> Activo</label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>Cancelar</Button>
                <Button disabled={busy} onClick={() => save(draft)}>Guardar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
