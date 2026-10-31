'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Landmark, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  deleteReceivedCheque,
  settleReceivedCheques,
  unsettleReceivedCheque,
  upsertReceivedCheque,
} from '@/lib/tesoreria/server/actions-received-cheques'
import type {
  TreasuryAccount,
  TreasuryReceivedCheque,
  TreasuryReceivedChequeStatus,
  TreasuryTransaction,
} from '@/lib/tesoreria/types'
import { cn } from '@/lib/utils'
import { formatDate, formatMoney, todayIso } from './format'

const statusLabels: Record<TreasuryReceivedChequeStatus, string> = {
  cartera: 'En cartera',
  depositado: 'Depositado',
  descontado: 'Descontado',
  endosado: 'Endosado',
  rechazado: 'Rechazado',
}

type Draft = {
  id?: string
  chequeNumber: string
  bankName: string
  issuerName: string
  issuerCuit: string
  amount: number | undefined
  receivedDate: string
  paymentDate: string
  status: TreasuryReceivedChequeStatus
  endorsedTo: string
  notes: string
}

type Props = {
  accounts: TreasuryAccount[]
  cheques: TreasuryReceivedCheque[]
  /** Créditos de bancos recientes que todavía no liquidan ningún cheque. */
  credits: TreasuryTransaction[]
  /** Créditos ya usados para liquidar cheques (para mostrar el costo del descuento). */
  settlements: TreasuryTransaction[]
}

export function ReceivedChequesView({ accounts, cheques, credits, settlements }: Props) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [settleOpen, setSettleOpen] = useState(false)
  const [settleKind, setSettleKind] = useState<'descontado' | 'depositado'>('descontado')
  const [creditId, setCreditId] = useState('')
  const [filter, setFilter] = useState<'cartera' | 'todos'>('cartera')
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const settlementById = useMemo(() => new Map(settlements.map((t) => [t.id, t])), [settlements])

  const visible = cheques.filter((c) => filter === 'todos' || c.status === 'cartera')
  const inPortfolio = cheques.filter((c) => c.status === 'cartera')
  const selectedCheques = cheques.filter((c) => selected.has(c.id))
  const selectedTotal = selectedCheques.reduce((a, c) => a + c.amount, 0)
  const credit = credits.find((t) => t.id === creditId)

  // Costo de cada descuento: valor de los cheques − lo acreditado.
  const discounts = useMemo(() => {
    const byTx = new Map<string, TreasuryReceivedCheque[]>()
    for (const c of cheques) {
      if (c.status !== 'descontado' || !c.settlementTransactionId) continue
      byTx.set(c.settlementTransactionId, [...(byTx.get(c.settlementTransactionId) ?? []), c])
    }
    return [...byTx.entries()].map(([txId, list]) => {
      const face = list.reduce((a, c) => a + c.amount, 0)
      const credited = settlementById.get(txId)?.amount ?? 0
      return { txId, list, face, credited, cost: face - credited, date: settlementById.get(txId)?.txDate ?? null }
    })
  }, [cheques, settlementById])

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

  const newDraft = (): Draft => ({
    chequeNumber: '', bankName: '', issuerName: '', issuerCuit: '', amount: undefined,
    receivedDate: todayIso(), paymentDate: '', status: 'cartera', endorsedTo: '', notes: '',
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">En cartera</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatMoney(inPortfolio.reduce((a, c) => a + c.amount, 0))}</div>
            <p className="mt-1 text-xs text-muted-foreground">{inPortfolio.length} cheque{inPortfolio.length === 1 ? '' : 's'} de terceros sin depositar</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Costo de descontar cheques</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">{formatMoney(discounts.reduce((a, d) => a + d.cost, 0))}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Diferencia entre el valor de los cheques descontados y lo que acreditó el banco ({discounts.length} descuento{discounts.length === 1 ? '' : 's'} registrados).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Cheques recibidos</CardTitle>
            <CardDescription>
              Cheques de clientes u otros terceros. Al depositarlos o descontarlos, vinculalos con el crédito del banco (por ejemplo "CCERR OVER CASH").
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as 'cartera' | 'todos')}>
              <ToggleGroupItem value="cartera" className="px-3">En cartera</ToggleGroupItem>
              <ToggleGroupItem value="todos" className="px-3">Todos</ToggleGroupItem>
            </ToggleGroup>
            <Button variant="secondary" disabled={selected.size === 0} onClick={() => { setSettleOpen(true); setCreditId('') }}>
              <Landmark className="mr-2 h-4 w-4" />Depositar / descontar ({selected.size})
            </Button>
            <Button onClick={() => setDraft(newDraft())}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-28">N°</TableHead>
                <TableHead>Librador</TableHead>
                <TableHead className="w-28">Fecha de pago</TableHead>
                <TableHead className="w-36 text-right">Monto</TableHead>
                <TableHead className="w-32">Estado</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No hay cheques en esta vista</TableCell></TableRow>
              )}
              {visible.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.status === 'cartera' && (
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(selected)
                          if (v === true) next.add(c.id)
                          else next.delete(c.id)
                          setSelected(next)
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">{c.chequeNumber}</div>
                    {c.bankName && <div className="text-xs text-muted-foreground">{c.bankName}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{c.issuerName}</div>
                    {(c.issuerCuit || c.endorsedTo) && (
                      <div className="text-xs text-muted-foreground">{[c.issuerCuit, c.endorsedTo && `endosado a ${c.endorsedTo}`].filter(Boolean).join(' · ')}</div>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(c.paymentDate)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(c.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{statusLabels[c.status]}</Badge>
                    {c.settlementTransactionId && settlementById.get(c.settlementTransactionId) && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {accountName.get(settlementById.get(c.settlementTransactionId)!.accountId)} · {formatDate(settlementById.get(c.settlementTransactionId)!.txDate)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {(c.status === 'depositado' || c.status === 'descontado') && (
                        <Button variant="ghost" size="icon" title="Volver a cartera" disabled={busy} onClick={() => run(() => unsettleReceivedCheque(c.id))}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() =>
                          setDraft({
                            id: c.id,
                            chequeNumber: c.chequeNumber,
                            bankName: c.bankName ?? '',
                            issuerName: c.issuerName,
                            issuerCuit: c.issuerCuit ?? '',
                            amount: c.amount,
                            receivedDate: c.receivedDate ?? '',
                            paymentDate: c.paymentDate ?? '',
                            status: c.status,
                            endorsedTo: c.endorsedTo ?? '',
                            notes: c.notes ?? '',
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        onClick={() => window.confirm(`¿Enviar el cheque N° ${c.chequeNumber} a la papelera?`) && run(() => deleteReceivedCheque(c.id))}
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

      {discounts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Descuentos registrados</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cheques</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Acreditado</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.map((d) => (
                  <TableRow key={d.txId}>
                    <TableCell>{formatDate(d.date)}</TableCell>
                    <TableCell className="text-sm">{d.list.map((c) => `N° ${c.chequeNumber}`).join(', ')}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.face)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.credited)}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-700 dark:text-red-400">{formatMoney(d.cost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.face ? ((d.cost / d.face) * 100).toFixed(2) : '0'}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Depositar o descontar {selected.size} cheque{selected.size === 1 ? '' : 's'}</DialogTitle>
            <DialogDescription>Valor total {formatMoney(selectedTotal)}. Elegí el crédito del banco que corresponde.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ToggleGroup type="single" variant="outline" value={settleKind} onValueChange={(v) => v && setSettleKind(v as 'descontado' | 'depositado')} className="w-full">
              <ToggleGroupItem value="descontado" className="flex-1">Se descontaron</ToggleGroupItem>
              <ToggleGroupItem value="depositado" className="flex-1">Se depositaron</ToggleGroupItem>
            </ToggleGroup>
            <div className="space-y-2">
              <Label>Crédito del banco</Label>
              <Select value={creditId} onValueChange={setCreditId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Elegí el movimiento" /></SelectTrigger>
                <SelectContent>
                  {credits.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {formatDate(t.txDate)} · {accountName.get(t.accountId)} · {formatMoney(t.amount)} · {t.descriptionRaw.slice(0, 40)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {credit && settleKind === 'descontado' && (
              <p className={cn('rounded-md p-2 text-sm', selectedTotal - credit.amount >= 0 ? 'bg-muted' : 'bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100')}>
                Costo del descuento: <strong>{formatMoney(selectedTotal - credit.amount)}</strong>
                {selectedTotal > 0 && ` (${(((selectedTotal - credit.amount) / selectedTotal) * 100).toFixed(2)}% del valor)`}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)} disabled={busy}>Cancelar</Button>
            <Button
              disabled={busy || !creditId}
              onClick={() =>
                run(() => settleReceivedCheques([...selected], creditId, settleKind), () => {
                  setSettleOpen(false)
                  setSelected(new Set())
                })
              }
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          {draft && (
            <>
              <DialogHeader><DialogTitle>{draft.id ? 'Editar cheque recibido' : 'Nuevo cheque recibido'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>N° de cheque</Label><Input value={draft.chequeNumber} onChange={(e) => setDraft({ ...draft, chequeNumber: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Banco</Label><Input value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} placeholder="Opcional" /></div>
                  <div className="space-y-2"><Label>Monto</Label><NumberInput decimals={2} value={draft.amount} onValueChange={(v) => setDraft({ ...draft, amount: v })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Librador / cliente</Label><Input value={draft.issuerName} onChange={(e) => setDraft({ ...draft, issuerName: e.target.value })} /></div>
                  <div className="space-y-2"><Label>CUIT (opcional)</Label><Input value={draft.issuerCuit} onChange={(e) => setDraft({ ...draft, issuerCuit: e.target.value.replace(/\D/g, '') })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Recibido</Label><Input type="date" value={draft.receivedDate} onChange={(e) => setDraft({ ...draft, receivedDate: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Fecha de pago</Label><Input type="date" value={draft.paymentDate} onChange={(e) => setDraft({ ...draft, paymentDate: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as TreasuryReceivedChequeStatus })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(['cartera', 'endosado', 'rechazado'] as const).map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                        {draft.id && (draft.status === 'depositado' || draft.status === 'descontado') && (
                          <SelectItem value={draft.status}>{statusLabels[draft.status]}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {draft.status === 'endosado' && (
                    <div className="space-y-2"><Label>Endosado a</Label><Input value={draft.endorsedTo} onChange={(e) => setDraft({ ...draft, endorsedTo: e.target.value })} /></div>
                  )}
                </div>
                <div className="space-y-2"><Label>Notas</Label><Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>Cancelar</Button>
                <Button
                  disabled={busy}
                  onClick={() => {
                    if (!draft.chequeNumber.trim() || !draft.amount || !draft.issuerName.trim()) return toast.error('Completá número, monto y librador')
                    run(
                      () =>
                        upsertReceivedCheque({
                          id: draft.id,
                          chequeNumber: draft.chequeNumber,
                          bankName: draft.bankName || null,
                          issuerName: draft.issuerName,
                          issuerCuit: draft.issuerCuit || null,
                          amount: draft.amount!,
                          receivedDate: draft.receivedDate || null,
                          paymentDate: draft.paymentDate || null,
                          status: draft.status,
                          endorsedTo: draft.endorsedTo || null,
                          notes: draft.notes || null,
                        }),
                      () => setDraft(null)
                    )
                  }}
                >
                  Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
