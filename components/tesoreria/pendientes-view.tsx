'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, CheckCircle2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { confirmInternalPair, reapplyRules } from '@/lib/tesoreria/server/actions-transactions'
import type { TreasuryAccount, TreasuryCategory, TreasuryTransaction } from '@/lib/tesoreria/types'
import { ClassifyDialog } from './classify-dialog'
import { amountClass, formatDate, formatMoney } from './format'

type Pair = { outId: string; inId: string; amount: number; daysApart: number; out: TreasuryTransaction; in: TreasuryTransaction }

type Props = {
  accounts: TreasuryAccount[]
  categories: TreasuryCategory[]
  pending: TreasuryTransaction[]
  pairs: Pair[]
}

export function PendientesView({ accounts, categories, pending, pairs }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<TreasuryTransaction | null>(null)
  const [busy, startTransition] = useTransition()
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  const total = pending.reduce((acc, t) => acc + Math.abs(t.amount), 0)

  const run = (fn: () => Promise<{ error?: string; success?: string }>) =>
    startTransition(async () => {
      const r = await fn()
      if (r.error) toast.error(r.error)
      else {
        toast.success(r.success)
        router.refresh()
      }
    })

  return (
    <div className="space-y-6">
      {pairs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" />¿Transferencias entre cuentas propias?</CardTitle>
            <CardDescription>
              Mismo monto que sale de una cuenta y entra a otra en ±2 días. Si lo confirmás, no suma como gasto ni como ingreso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pairs.map((p) => (
              <div key={p.outId} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
                <span className="font-semibold tabular-nums">{formatMoney(p.amount)}</span>
                <span className="text-muted-foreground">
                  {accountName.get(p.out.accountId)} ({formatDate(p.out.txDate)}) → {accountName.get(p.in.accountId)} ({formatDate(p.in.txDate)})
                </span>
                <span className="w-full truncate font-mono text-xs text-muted-foreground md:w-auto md:flex-1">
                  {p.out.descriptionRaw} / {p.in.descriptionRaw}
                </span>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => confirmInternalPair(p.outId, p.inId))}>
                  Es interna
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Pendientes de clasificar</CardTitle>
            <CardDescription>
              {pending.length === 0
                ? 'Nada pendiente.'
                : `${pending.length} movimientos por ${formatMoney(total)}. Al clasificar podés crear una regla para que la próxima vez se haga solo.`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run(reapplyRules)}>
            <RefreshCw className="mr-2 h-4 w-4" />Re-aplicar reglas
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p>La bandeja está vacía.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Fecha</TableHead>
                  <TableHead className="w-28">Cuenta</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-32">CUIT</TableHead>
                  <TableHead className="w-36 text-right">Monto</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((tx) => (
                  <TableRow key={tx.id} className="cursor-pointer" onClick={() => setEditing(tx)}>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDate(tx.txDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{accountName.get(tx.accountId)}</TableCell>
                    <TableCell className="max-w-[420px]">
                      <div className="truncate font-mono text-xs" title={tx.descriptionRaw}>{tx.descriptionRaw}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{tx.counterpartyCuit ?? '—'}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${amountClass(tx.amount)}`}>{formatMoney(tx.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="secondary">Clasificar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ClassifyDialog
        tx={editing}
        accountName={editing ? accountName.get(editing.accountId) : undefined}
        categories={categories}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  )
}
