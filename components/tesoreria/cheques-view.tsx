'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Ban, Banknote, CalendarClock, Link2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { deleteCheque, setChequeVoided, upsertCheque } from '@/lib/tesoreria/server/actions-cheques'
import type { ChequeOutlook } from '@/lib/tesoreria/cheques'
import type {
  TreasuryAccount,
  TreasuryCategory,
  TreasuryCheque,
  TreasuryChequeStatus,
  TreasuryScope,
  TreasuryTransaction,
} from '@/lib/tesoreria/types'
import { cn } from '@/lib/utils'
import { formatDate, formatMoney, scopeLabels, todayIso } from './format'

const statusLabels: Record<TreasuryChequeStatus, string> = {
  emitido: 'Por debitar',
  debitado: 'Debitado',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
}

const statusClass: Record<TreasuryChequeStatus, string> = {
  emitido: 'border-blue-300 text-blue-800 dark:text-blue-300',
  debitado: 'border-green-300 text-green-800 dark:text-green-300',
  rechazado: 'border-red-300 text-red-800 dark:text-red-300',
  anulado: 'text-muted-foreground',
}

type Draft = {
  id?: string
  accountId: string
  chequeNumber: string
  amount: number | undefined
  issueDate: string
  paymentDate: string
  payeeName: string
  payeeCuit: string
  categoryId: string
  scope: TreasuryScope | ''
  notes: string
}

type Props = {
  accounts: TreasuryAccount[]
  categories: TreasuryCategory[]
  cheques: TreasuryCheque[]
  unregistered: TreasuryTransaction[]
  outlook: ChequeOutlook
  today: string
}

type Filter = 'pendientes' | 'todos' | TreasuryChequeStatus

export function ChequesView({ accounts, categories, cheques, unregistered, outlook, today }: Props) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [filter, setFilter] = useState<Filter>('pendientes')

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const bankAccounts = accounts.filter((a) => a.isActive && a.kind === 'bank')

  const visible = cheques.filter((c) => {
    if (filter === 'todos') return true
    if (filter === 'pendientes') return c.status === 'emitido' || c.status === 'rechazado'
    return c.status === filter
  })

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

  const newDraft = (from?: TreasuryTransaction): Draft => ({
    accountId: from?.accountId ?? bankAccounts[0]?.id ?? '',
    chequeNumber: from?.reference ?? '',
    amount: from ? Math.abs(from.amount) : undefined,
    issueDate: '',
    paymentDate: from?.txDate ?? todayIso(),
    payeeName: '',
    payeeCuit: '',
    categoryId: '',
    scope: '',
    notes: '',
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Banknote className="h-4 w-4" />Cheques por debitar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatMoney(outlook.pendingAmount)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{outlook.pendingCount} cheque{outlook.pendingCount === 1 ? '' : 's'} emitido{outlook.pendingCount === 1 ? '' : 's'} que todavía no salieron del banco</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarClock className="h-4 w-4" />Próximos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatMoney(outlook.next7Amount)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Plata que tiene que haber en la cuenta para cubrirlos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />Débitos sin registrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold tabular-nums', unregistered.length > 0 && 'text-amber-700 dark:text-amber-400')}>
              {unregistered.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMoney(unregistered.reduce((acc, t) => acc + Math.abs(t.amount), 0))} pagados con cheque sin saber a quién
            </p>
          </CardContent>
        </Card>
      </div>

      {unregistered.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Débitos de cheques sin registrar</CardTitle>
            <CardDescription>
              El banco sólo informa el número. Registrá a quién fue cada cheque y el débito se clasifica solo.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Fecha</TableHead>
                  <TableHead className="w-28">Cuenta</TableHead>
                  <TableHead className="w-32">N° cheque</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-36 text-right">Monto</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unregistered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="tabular-nums">{formatDate(t.txDate)}</TableCell>
                    <TableCell>{accountName.get(t.accountId)}</TableCell>
                    <TableCell className="font-mono text-xs">{t.reference ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{t.descriptionRaw}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(t.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => setDraft(newDraft(t))}>Registrar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Registro de cheques</CardTitle>
            <CardDescription>
              Cargá cada cheque cuando lo entregás. Cuando el banco lo debite, se vincula y se clasifica solo.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
              <ToggleGroupItem value="pendientes" className="px-3">Pendientes</ToggleGroupItem>
              <ToggleGroupItem value="debitado" className="px-3">Debitados</ToggleGroupItem>
              <ToggleGroupItem value="anulado" className="px-3">Anulados</ToggleGroupItem>
              <ToggleGroupItem value="todos" className="px-3">Todos</ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={() => setDraft(newDraft())} disabled={bankAccounts.length === 0}>
              <Plus className="mr-2 h-4 w-4" />Nuevo cheque
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">N°</TableHead>
                <TableHead>Beneficiario</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="w-28">Fecha de pago</TableHead>
                <TableHead className="w-36 text-right">Monto</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No hay cheques en esta vista</TableCell>
                </TableRow>
              )}
              {visible.map((c) => {
                const overdue = c.status === 'emitido' && c.paymentDate && c.paymentDate < today
                return (
                  <TableRow key={c.id} className={c.status === 'anulado' ? 'opacity-60' : undefined}>
                    <TableCell>
                      <div className="font-mono text-xs">{c.chequeNumber}</div>
                      <div className="text-xs text-muted-foreground">{accountName.get(c.accountId)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{c.payeeName}</div>
                      {(c.payeeCuit || c.notes) && (
                        <div className="text-xs text-muted-foreground">{[c.payeeCuit, c.notes].filter(Boolean).join(' · ')}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.categoryId ? categoryName.get(c.categoryId) : <span className="text-amber-700 dark:text-amber-400">Sin categoría</span>}
                      {c.scope && <span className="text-muted-foreground"> · {scopeLabels[c.scope]}</span>}
                    </TableCell>
                    <TableCell className={cn('tabular-nums', overdue && 'text-amber-700 dark:text-amber-400')}>
                      {formatDate(c.paymentDate)}
                      {overdue && <div className="text-[11px]">ya venció</div>}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(c.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass[c.status]}>
                        {c.status === 'debitado' && <Link2 />}
                        {statusLabels[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          onClick={() =>
                            setDraft({
                              id: c.id,
                              accountId: c.accountId,
                              chequeNumber: c.chequeNumber,
                              amount: c.amount,
                              issueDate: c.issueDate ?? '',
                              paymentDate: c.paymentDate ?? '',
                              payeeName: c.payeeName,
                              payeeCuit: c.payeeCuit ?? '',
                              categoryId: c.categoryId ?? '',
                              scope: c.scope ?? '',
                              notes: c.notes ?? '',
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {c.status !== 'debitado' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            title={c.status === 'anulado' ? 'Reactivar' : 'Anular (no se va a cobrar)'}
                            onClick={() => run(() => setChequeVoided(c.id, c.status !== 'anulado'))}
                          >
                            {c.status === 'anulado' ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          title="Enviar a la papelera"
                          onClick={() => {
                            if (window.confirm(`¿Enviar a la papelera el cheque N° ${c.chequeNumber}?`)) run(() => deleteCheque(c.id))
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ChequeDialog
        draft={draft}
        setDraft={setDraft}
        accounts={bankAccounts}
        categories={categories}
        busy={busy}
        onSave={(d) =>
          run(
            () =>
              upsertCheque({
                id: d.id,
                accountId: d.accountId,
                chequeNumber: d.chequeNumber,
                amount: d.amount ?? 0,
                issueDate: d.issueDate || null,
                paymentDate: d.paymentDate || null,
                payeeName: d.payeeName,
                payeeCuit: d.payeeCuit || null,
                categoryId: d.categoryId || null,
                scope: d.scope || null,
                notes: d.notes || null,
              }),
            () => setDraft(null)
          )
        }
      />
    </div>
  )
}

function ChequeDialog({
  draft,
  setDraft,
  accounts,
  categories,
  busy,
  onSave,
}: {
  draft: Draft | null
  setDraft: (d: Draft | null) => void
  accounts: TreasuryAccount[]
  categories: TreasuryCategory[]
  busy: boolean
  onSave: (d: Draft) => void
}) {
  const expenseCategories = categories.filter((c) => c.isActive && c.kind === 'expense')
  const [local, setLocal] = useState<Draft | null>(draft)
  useEffect(() => setLocal(draft), [draft])
  if (!local) return null

  const set = (patch: Partial<Draft>) => setLocal({ ...local, ...patch })
  const onCategory = (id: string) => {
    const cat = categories.find((c) => c.id === id)
    set({ categoryId: id, scope: cat?.defaultScope ?? local.scope })
  }

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{local.id ? 'Editar cheque' : 'Registrar cheque'}</DialogTitle>
          <DialogDescription>
            El número tiene que ser el mismo que figura en el extracto (columna Nro. Transacción en Macro).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Cuenta</Label>
              <Select value={local.accountId} onValueChange={(v) => set({ accountId: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>N° de cheque</Label>
              <Input value={local.chequeNumber} onChange={(e) => set({ chequeNumber: e.target.value.replace(/\D/g, '') })} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <NumberInput decimals={2} value={local.amount} onValueChange={(v) => set({ amount: v })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>A quién</Label>
              <Input value={local.payeeName} onChange={(e) => set({ payeeName: e.target.value })} placeholder="Ej.: Gomería Ruta 9" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>CUIT (opcional)</Label>
              <Input value={local.payeeCuit} onChange={(e) => set({ payeeCuit: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="11 dígitos" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha de emisión</Label>
              <Input type="date" value={local.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de pago</Label>
              <Input type="date" value={local.paymentDate} onChange={(e) => set({ paymentDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={local.categoryId} onValueChange={onCategory}>
              <SelectTrigger className="w-full"><SelectValue placeholder="¿Qué se pagó?" /></SelectTrigger>
              <SelectContent>
                {expenseCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <RadioGroup value={local.scope} onValueChange={(v) => set({ scope: v as TreasuryScope })} className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="empresa" /> Empresa</label>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="personal" /> Personal</label>
          </RadioGroup>
          <div className="space-y-2">
            <Label>Concepto (opcional)</Label>
            <Textarea rows={2} value={local.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Ej.: 4 cubiertas para el Scania" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>Cancelar</Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (!local.chequeNumber) return toast.error('Poné el número de cheque')
              if (!local.amount) return toast.error('Poné el monto')
              if (!local.payeeName.trim()) return toast.error('¿A quién se le dio el cheque?')
              onSave(local)
            }}
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
