'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { classifyTransaction, type ClassifyInput } from '@/lib/tesoreria/server/actions-transactions'
import { suggestPattern } from '@/lib/tesoreria/engine'
import type { TreasuryCategory, TreasuryScope, TreasuryTransaction } from '@/lib/tesoreria/types'
import { categoriesForAmount, formatDate, formatMoney, kindLabels } from './format'

type LearnMode = 'none' | 'rule' | 'counterparty'

type Props = {
  tx: TreasuryTransaction | null
  accountName?: string
  categories: TreasuryCategory[]
  onOpenChange: (open: boolean) => void
}

/**
 * Clasifica un movimiento (categoría + ámbito) y, opcionalmente, "enseña" al sistema:
 * crea una regla por texto o guarda la contraparte por CUIT. Al aprender,
 * se re-clasifican solos los demás pendientes que coincidan.
 */
export function ClassifyDialog({ tx, accountName, categories, onOpenChange }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [categoryId, setCategoryId] = useState<string>('')
  const [scope, setScope] = useState<TreasuryScope | ''>('')
  const [notes, setNotes] = useState('')
  const [learn, setLearn] = useState<LearnMode>('none')
  const [pattern, setPattern] = useState('')
  const [onlyThisAccount, setOnlyThisAccount] = useState(false)
  const [counterpartyName, setCounterpartyName] = useState('')

  useEffect(() => {
    if (!tx) return
    setCategoryId(tx.categoryId ?? '')
    setScope(tx.scope ?? '')
    setNotes(tx.notes ?? '')
    setLearn(tx.classification === 'pending' ? (tx.counterpartyCuit ? 'counterparty' : 'rule') : 'none')
    setPattern(suggestPattern(tx.descriptionNorm))
    setOnlyThisAccount(false)
    setCounterpartyName('')
  }, [tx])

  const options = useMemo(() => (tx ? categoriesForAmount(categories, tx.amount) : []), [tx, categories])
  const selected = categories.find((c) => c.id === categoryId)
  const isInternal = selected?.kind === 'internal'

  // Al elegir categoría, proponemos su ámbito por defecto.
  const onCategory = (id: string) => {
    setCategoryId(id)
    const cat = categories.find((c) => c.id === id)
    if (cat?.kind === 'internal') setScope('')
    else if (cat?.defaultScope) setScope(cat.defaultScope)
  }

  const submit = () => {
    if (!tx) return
    if (!categoryId) return toast.error('Elegí una categoría')
    if (!isInternal && !scope) return toast.error('Elegí si es de la empresa o personal')

    let learnPayload: ClassifyInput['learn']
    if (learn === 'rule') {
      if (pattern.trim().length < 2) return toast.error('El texto de la regla es muy corto')
      learnPayload = {
        kind: 'rule',
        matchType: 'contains',
        pattern: pattern.trim(),
        direction: tx.amount >= 0 ? 'in' : 'out',
        onlyThisAccount,
      }
    } else if (learn === 'counterparty') {
      if (!counterpartyName.trim()) return toast.error('Poné un nombre para la contraparte')
      learnPayload = { kind: 'counterparty', name: counterpartyName.trim() }
    }

    startTransition(async () => {
      const result = await classifyTransaction({
        id: tx.id,
        categoryId,
        scope: isInternal ? null : (scope as TreasuryScope),
        notes,
        learn: learnPayload,
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
    <Dialog open={!!tx} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {tx && (
          <>
            <DialogHeader>
              <DialogTitle>Clasificar movimiento</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-1 pt-1">
                  <p className="font-mono text-xs text-foreground break-all">{tx.descriptionRaw}</p>
                  <p>
                    {formatDate(tx.txDate)} · {accountName ?? ''} ·{' '}
                    <span className="font-semibold tabular-nums text-foreground">{formatMoney(tx.amount)}</span>
                    {tx.counterpartyCuit && <> · CUIT {tx.counterpartyCuit}</>}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={onCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elegí una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        <span className="ml-2 text-xs text-muted-foreground">{kindLabels[c.kind]}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isInternal && (
                <div className="space-y-2">
                  <Label>¿De quién es?</Label>
                  <RadioGroup value={scope} onValueChange={(v) => setScope(v as TreasuryScope)} className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="empresa" /> Empresa
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="personal" /> Personal
                    </label>
                  </RadioGroup>
                </div>
              )}
              {isInternal && (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Los movimientos internos no suman como ingreso ni egreso.
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="tx-notes">Nota (opcional)</Label>
                <Textarea id="tx-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: arreglo de la heladera" />
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <Label>¿Que el sistema lo aprenda?</Label>
                <RadioGroup value={learn} onValueChange={(v) => setLearn(v as LearnMode)} className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="none" /> No, sólo este movimiento
                  </label>
                  {tx.counterpartyCuit && (
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="counterparty" /> Recordar el CUIT {tx.counterpartyCuit}
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="rule" /> Crear una regla por texto
                  </label>
                </RadioGroup>

                {learn === 'counterparty' && (
                  <Input
                    value={counterpartyName}
                    onChange={(e) => setCounterpartyName(e.target.value)}
                    placeholder="Nombre de la contraparte (ej.: Proveedor de cubiertas)"
                  />
                )}
                {learn === 'rule' && (
                  <div className="space-y-2">
                    <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="Texto que contiene la descripción" />
                    <p className="text-xs text-muted-foreground">
                      Se aplica a los {tx.amount >= 0 ? 'ingresos' : 'egresos'} cuya descripción contenga este texto.
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={onlyThisAccount} onCheckedChange={(v) => setOnlyThisAccount(v === true)} />
                      Sólo en {accountName ?? 'esta cuenta'}
                    </label>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
              <Button onClick={submit} disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
