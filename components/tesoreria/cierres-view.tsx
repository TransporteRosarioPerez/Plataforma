'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Lock, LockOpen, Trash2, Wallet } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { closeMonth, createCashCount, deleteCashCount, reopenMonth } from '@/lib/tesoreria/server/actions-closing'
import type { CashCount, CloseRow, MonthClose } from '@/lib/tesoreria/closing'
import { formatMonthLabel } from '@/lib/tesoreria/closing-labels'
import type { TreasuryAccount } from '@/lib/tesoreria/types'
import { cn } from '@/lib/utils'
import { formatDate, formatDateTime, formatMoney } from './format'

type Props = {
  accounts: TreasuryAccount[]
  rows: CloseRow[]
  currentMonth: string
  history: MonthClose[]
  cashAccount: TreasuryAccount | null
  cashCounts: CashCount[]
  cashSystemToday: number
  today: string
}

export function CierresView({ accounts, rows, currentMonth, history, cashAccount, cashCounts, cashSystemToday, today }: Props) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [closing, setClosing] = useState<CloseRow | null>(null)
  const [closeNotes, setCloseNotes] = useState('')
  const [reopening, setReopening] = useState<CloseRow | null>(null)
  const [reason, setReason] = useState('')
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const accountKind = useMemo(() => new Map(accounts.map((a) => [a.id, a.kind])), [accounts])
  const months = [...new Set(rows.map((r) => r.month))]

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cierre mensual</CardTitle>
          <CardDescription>
            Un mes está listo para cerrar cuando no tiene pendientes y el saldo del sistema coincide con el del banco.
            Cerrado, no se pueden cargar ni borrar movimientos de ese mes sin reabrirlo, y si un extracto trae algo de ese mes, la
            importación lo avisa.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Mes</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Movimientos</TableHead>
                <TableHead className="text-right">Pendientes</TableHead>
                <TableHead className="text-right">Saldo sistema</TableHead>
                <TableHead className="text-right">Banco / arqueo</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="w-44" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((month) =>
                rows
                  .filter((r) => r.month === month)
                  .map((r, i) => {
                    const ok = r.pendingCount === 0 && r.difference !== null && Math.abs(r.difference) < 0.01
                    const isCurrent = month === currentMonth
                    return (
                      <TableRow key={`${r.accountId}-${month}`} className={cn(i === 0 && 'border-t-2')}>
                        <TableCell className="font-medium">{i === 0 ? formatMonthLabel(month) : ''}</TableCell>
                        <TableCell>{accountName.get(r.accountId)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.movementCount}</TableCell>
                        <TableCell className={cn('text-right tabular-nums', r.pendingCount > 0 && 'font-semibold text-amber-700 dark:text-amber-400')}>
                          {r.pendingCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.systemBalance)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.referenceBalance === null ? (
                            <span className="text-xs text-muted-foreground">
                              {accountKind.get(r.accountId) === 'cash' ? 'sin arqueo' : 'sin extracto'}
                            </span>
                          ) : (
                            <>
                              {formatMoney(r.referenceBalance)}
                              <div className="text-[11px] text-muted-foreground">al {formatDate(r.referenceDate)}</div>
                            </>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums',
                            r.difference !== null && Math.abs(r.difference) >= 0.01 && 'font-semibold text-red-700 dark:text-red-400'
                          )}
                        >
                          {r.difference === null ? '—' : formatMoney(r.difference)}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.close ? (
                            <div className="flex items-center justify-end gap-2">
                              <Badge variant="secondary"><Lock />Cerrado</Badge>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setReopening(r); setReason('') }}>
                                <LockOpen className="mr-1 h-4 w-4" />Reabrir
                              </Button>
                            </div>
                          ) : isCurrent ? (
                            <span className="text-xs text-muted-foreground">En curso</span>
                          ) : (
                            <Button
                              size="sm"
                              variant={ok ? 'default' : 'outline'}
                              disabled={busy || r.movementCount === 0}
                              onClick={() => { setClosing(r); setCloseNotes('') }}
                            >
                              {ok && <CheckCircle2 className="mr-1 h-4 w-4" />}Cerrar mes
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {cashAccount && (
        <CashCountCard
          account={cashAccount}
          counts={cashCounts}
          systemToday={cashSystemToday}
          today={today}
          busy={busy}
          run={run}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de cierres</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Saldo al cierre</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead>Cerrado</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.slice(0, 30).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{formatMonthLabel(c.month)}</TableCell>
                    <TableCell>{accountName.get(c.accountId)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(c.systemBalance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.difference === null ? '—' : formatMoney(c.difference)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(c.closedAt)}</TableCell>
                    <TableCell className="text-sm">
                      {c.status === 'closed' ? (
                        'Cerrado'
                      ) : (
                        <span className="text-muted-foreground">
                          Reabierto {c.reopenedAt ? formatDateTime(c.reopenedAt) : ''} · {c.reopenReason}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!closing} onOpenChange={(o) => !o && setClosing(null)}>
        <DialogContent className="sm:max-w-md">
          {closing && (
            <>
              <DialogHeader>
                <DialogTitle>Cerrar {formatMonthLabel(closing.month)} · {accountName.get(closing.accountId)}</DialogTitle>
                <DialogDescription>Se guarda una foto del saldo. Después se puede reabrir dejando el motivo.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {closing.pendingCount > 0 && (
                  <p className="rounded-md bg-amber-50 p-2 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    Quedan {closing.pendingCount} movimientos sin clasificar en este mes.
                  </p>
                )}
                {closing.difference !== null && Math.abs(closing.difference) >= 0.01 && (
                  <p className="rounded-md bg-red-50 p-2 text-red-900 dark:bg-red-950 dark:text-red-100">
                    El saldo del sistema difiere del banco en {formatMoney(closing.difference)}. Revisá el saldo inicial en Configuración o si falta un extracto.
                  </p>
                )}
                {closing.referenceBalance === null && (
                  <p className="rounded-md bg-muted p-2">No hay saldo de referencia del banco/arqueo para comparar.</p>
                )}
                <div className="space-y-2">
                  <Label>Nota (opcional)</Label>
                  <Textarea rows={2} value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setClosing(null)} disabled={busy}>Cancelar</Button>
                <Button disabled={busy} onClick={() => run(() => closeMonth(closing.accountId, closing.month, closeNotes), () => setClosing(null))}>
                  Cerrar mes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reopening} onOpenChange={(o) => !o && setReopening(null)}>
        <DialogContent className="sm:max-w-md">
          {reopening?.close && (
            <>
              <DialogHeader>
                <DialogTitle>Reabrir {formatMonthLabel(reopening.month)} · {accountName.get(reopening.accountId)}</DialogTitle>
                <DialogDescription>El motivo queda en el historial y en Auditoría.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: faltaba el 31/10 en el extracto" autoFocus />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReopening(null)} disabled={busy}>Cancelar</Button>
                <Button disabled={busy} onClick={() => run(() => reopenMonth(reopening.close!.id, reason), () => setReopening(null))}>
                  Reabrir
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CashCountCard({
  account,
  counts,
  systemToday,
  today,
  busy,
  run,
}: {
  account: TreasuryAccount
  counts: CashCount[]
  systemToday: number
  today: string
  busy: boolean
  run: (fn: () => Promise<{ error?: string; success?: string }>, onOk?: () => void) => void
}) {
  const [countDate, setCountDate] = useState(today)
  const [counted, setCounted] = useState<number | undefined>()
  const [notes, setNotes] = useState('')
  const [adjust, setAdjust] = useState(true)
  const preview = counted === undefined || countDate !== today ? null : Math.round((counted - systemToday) * 100) / 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" />Arqueo de efectivo</CardTitle>
        <CardDescription>
          Contá la plata física y cargala. Si no coincide con el sistema, podés registrar el ajuste en "Diferencias de caja".
          Hoy el sistema dice {formatMoney(systemToday)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Fecha</Label>
            <Input type="date" value={countDate} max={today} onChange={(e) => setCountDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label>Efectivo contado</Label>
            <NumberInput decimals={2} value={counted} onValueChange={setCounted} className="w-44" placeholder="0,00" />
          </div>
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label>Nota</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox checked={adjust} onCheckedChange={(v) => setAdjust(v === true)} />
            Registrar el ajuste si hay diferencia
          </label>
          <Button
            disabled={busy || counted === undefined}
            onClick={() =>
              run(
                () => createCashCount({ accountId: account.id, countDate, countedAmount: counted ?? 0, notes, registerAdjustment: adjust }),
                () => { setCounted(undefined); setNotes('') }
              )
            }
          >
            Guardar arqueo
          </Button>
        </div>
        {preview !== null && Math.abs(preview) >= 0.01 && (
          <p className={cn('text-sm', preview < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400')}>
            {preview < 0 ? 'Faltan' : 'Sobran'} {formatMoney(Math.abs(preview))} respecto del sistema.
          </p>
        )}

        {counts.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Contado</TableHead>
                <TableHead className="text-right">Sistema</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead>Ajuste</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {counts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{formatDate(c.countDate)}{c.notes && <div className="text-xs text-muted-foreground">{c.notes}</div>}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(c.countedAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(c.systemAmount)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', Math.abs(c.difference) >= 0.01 && 'font-semibold')}>{formatMoney(c.difference)}</TableCell>
                  <TableCell className="text-sm">{c.adjustmentTransactionId ? 'Registrado' : Math.abs(c.difference) >= 0.01 ? 'No' : '—'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('¿Enviar este arqueo (y su ajuste) a la papelera?')) run(() => deleteCashCount(c.id))
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
