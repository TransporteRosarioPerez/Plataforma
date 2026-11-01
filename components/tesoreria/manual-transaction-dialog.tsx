'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { createManualTransaction } from '@/lib/tesoreria/server/actions-transactions'
import type { TreasuryAccount, TreasuryCategory, TreasuryScope } from '@/lib/tesoreria/types'
import { categoriesForAmount, todayIso } from './format'

type Kind = 'expense' | 'income' | 'transfer'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: TreasuryAccount[]
  categories: TreasuryCategory[]
}

/**
 * Carga manual pensada para el efectivo (por defecto elige la cuenta Efectivo).
 * "Transferencia" registra plata que pasa entre cuentas propias (ej.: depósito de efectivo en el banco).
 */
export function ManualTransactionDialog({ open, onOpenChange, accounts, categories }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const active = accounts.filter((a) => a.isActive)
  const cash = active.find((a) => a.kind === 'cash')

  const [kind, setKind] = useState<Kind>('expense')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [txDate, setTxDate] = useState(todayIso())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState<number | undefined>()
  const [categoryId, setCategoryId] = useState('')
  const [scope, setScope] = useState<TreasuryScope | ''>('empresa')

  useEffect(() => {
    if (!open) return
    setKind('expense')
    setAccountId(cash?.id ?? active[0]?.id ?? '')
    setToAccountId('')
    setTxDate(todayIso())
    setDescription('')
    setAmount(undefined)
    setCategoryId('')
    setScope('empresa')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const options = useMemo(
    () => categoriesForAmount(categories, kind === 'income' ? 1 : -1).filter((c) => c.kind !== 'internal'),
    [categories, kind]
  )

  const onCategory = (id: string) => {
    setCategoryId(id)
    const cat = categories.find((c) => c.id === id)
    if (cat?.defaultScope) setScope(cat.defaultScope)
  }

  const submit = () => {
    if (!accountId) return toast.error('Elegí la cuenta')
    if (!amount || amount <= 0) return toast.error('Ingresá un monto mayor a 0')
    if (!description.trim()) return toast.error('Escribí una descripción')

    startTransition(async () => {
      const result =
        kind === 'transfer'
          ? await createManualTransaction({
              type: 'transfer',
              accountId,
              toAccountId,
              txDate,
              description: description.trim(),
              amount,
            })
          : await createManualTransaction({
              type: kind,
              accountId,
              txDate,
              description: description.trim(),
              amount,
              categoryId: categoryId || null,
              scope: scope || null,
            })
      if (result.error) toast.error(result.error)
      else {
        toast.success(result.success)
        onOpenChange(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar movimiento</DialogTitle>
          <DialogDescription>Para efectivo u otros movimientos que no vienen en un extracto.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ToggleGroup type="single" variant="outline" value={kind} onValueChange={(v) => v && setKind(v as Kind)} className="w-full">
            <ToggleGroupItem value="expense" className="flex-1">Egreso</ToggleGroupItem>
            <ToggleGroupItem value="income" className="flex-1">Ingreso</ToggleGroupItem>
            <ToggleGroupItem value="transfer" className="flex-1">Entre cuentas</ToggleGroupItem>
          </ToggleGroup>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monto</Label>
              <NumberInput decimals={2} value={amount} onValueChange={setAmount} placeholder="0,00" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-date">Fecha</Label>
              <Input id="manual-date" type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-desc">Descripción</Label>
            <Input id="manual-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === 'transfer' ? 'Ej.: depósito de efectivo' : 'Ej.: gomería ruta 9'} />
          </div>

          {kind === 'transfer' && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Para depósitos de efectivo en un banco o retiros que no sean por cajero. Se registra en Efectivo y,
              cuando llega el extracto del banco, se vincula solo para no contarlo dos veces.
            </p>
          )}

          <div className={kind === 'transfer' ? 'grid grid-cols-2 gap-3' : ''}>
            <div className="space-y-2">
              <Label>{kind === 'transfer' ? 'Sale de' : 'Cuenta'}</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Cuenta" /></SelectTrigger>
                <SelectContent>
                  {active.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {kind === 'transfer' && (
              <div className="space-y-2">
                <Label>Entra a</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Cuenta" /></SelectTrigger>
                  <SelectContent>
                    {active
                      .filter((a) => a.id !== accountId)
                      // Siempre una punta es Efectivo: entre bancos las dos puntas llegan en los extractos.
                      .filter((a) => (active.find((x) => x.id === accountId)?.kind === 'cash' ? a.kind !== 'cash' : a.kind === 'cash'))
                      .map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {kind !== 'transfer' && (
            <>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={onCategory}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Opcional: queda en Pendientes" /></SelectTrigger>
                  <SelectContent>
                    {options.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as TreasuryScope)} className="flex gap-6">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="empresa" /> Empresa</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="personal" /> Personal</label>
              </RadioGroup>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
