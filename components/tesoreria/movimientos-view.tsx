'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { deleteTransaction } from '@/lib/tesoreria/server/actions-transactions'
import type { TreasuryAccount, TreasuryCategory, TreasuryTransaction } from '@/lib/tesoreria/types'
import { groupFeeLines } from '@/lib/tesoreria/grouping'
import { cn } from '@/lib/utils'
import { ClassifyDialog } from './classify-dialog'
import { ManualTransactionDialog } from './manual-transaction-dialog'
import { amountClass, classificationLabels, formatDate, formatMoney, scopeLabels } from './format'

type Filters = {
  desde: string
  hasta: string
  cuenta: string
  categoria: string
  ambito: string
  estado: string
  q: string
}

type Props = {
  accounts: TreasuryAccount[]
  categories: TreasuryCategory[]
  transactions: TreasuryTransaction[]
  filters: Filters
}

const ALL = '__all'

export function MovimientosView({ accounts, categories, transactions, filters }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<TreasuryTransaction | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [search, setSearch] = useState(filters.q)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const entries = useMemo(() => groupFeeLines(transactions), [transactions])

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const apply = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v)
    router.push(`/app/tesoreria/movimientos?${params.toString()}`)
  }

  const totals = transactions.reduce(
    (acc, t) => {
      if (t.isInternal) return acc
      if (t.amount >= 0) acc.in += t.amount
      else acc.out += -t.amount
      return acc
    },
    { in: 0, out: 0 }
  )

  const renderRow = (tx: TreasuryTransaction, nested = false) => (
                <TableRow key={tx.id} className={cn(tx.isInternal && 'text-muted-foreground', nested && 'bg-muted/30 text-sm')}>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatDate(tx.txDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">{accountName.get(tx.accountId)}</TableCell>
                  <TableCell className="max-w-[360px]">
                    <div className="truncate font-mono text-xs" title={tx.descriptionRaw}>{tx.descriptionRaw}</div>
                    {tx.notes && <div className="truncate text-xs text-muted-foreground">{tx.notes}</div>}
                  </TableCell>
                  <TableCell>
                    {tx.classification === 'pending' ? (
                      <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-300">
                        {classificationLabels.pending}
                      </Badge>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {tx.isInternal && <ArrowLeftRight className="h-3.5 w-3.5" />}
                        {tx.categoryId ? categoryName.get(tx.categoryId) : '—'}
                        {tx.classification === 'manual' && (
                          <span className="text-[10px] uppercase text-muted-foreground">manual</span>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{tx.scope ? scopeLabels[tx.scope] : '—'}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${amountClass(tx.amount)}`}>
                    {formatMoney(tx.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      {tx.source !== 'transfer_mirror' && (
                        <Button variant="ghost" size="icon" onClick={() => setEditing(tx)} title="Clasificar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => onDelete(tx)} title="Enviar a la papelera">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
  )

  const onDelete = async (tx: TreasuryTransaction) => {
    if (!confirm(`¿Enviar a la papelera "${tx.descriptionRaw}"?`)) return
    const r = await deleteTransaction(tx.id)
    if (r.error) toast.error(r.error)
    else {
      toast.success(r.success)
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Desde</span>
            <Input type="date" value={filters.desde} onChange={(e) => apply({ desde: e.target.value })} className="w-40" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Hasta</span>
            <Input type="date" value={filters.hasta} onChange={(e) => apply({ hasta: e.target.value })} className="w-40" />
          </div>
          <FilterSelect
            label="Cuenta"
            value={filters.cuenta}
            onChange={(v) => apply({ cuenta: v })}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          />
          <FilterSelect
            label="Categoría"
            value={filters.categoria}
            onChange={(v) => apply({ categoria: v })}
            options={[{ value: 'none', label: 'Sin categoría' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <FilterSelect
            label="Ámbito"
            value={filters.ambito}
            onChange={(v) => apply({ ambito: v })}
            options={[
              { value: 'empresa', label: 'Empresa' },
              { value: 'personal', label: 'Personal' },
              { value: 'none', label: 'Sin ámbito' },
            ]}
          />
          <FilterSelect
            label="Estado"
            value={filters.estado}
            onChange={(v) => apply({ estado: v })}
            options={[
              { value: 'pending', label: 'Pendiente' },
              { value: 'auto', label: 'Automático' },
              { value: 'manual', label: 'Manual' },
            ]}
          />
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              apply({ q: search })
            }}
          >
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Buscar</span>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Descripción" className="w-48" />
            </div>
            <Button type="submit" variant="secondary" size="icon"><Search className="h-4 w-4" /></Button>
          </form>
          <Button variant="ghost" size="sm" onClick={() => router.push('/app/tesoreria/movimientos')}>
            <X className="mr-1 h-4 w-4" />Limpiar
          </Button>
          <Button className="ml-auto" onClick={() => setManualOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Cargar movimiento
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>{transactions.length} movimientos</span>
        <span>Ingresos <strong className="tabular-nums text-green-700 dark:text-green-400">{formatMoney(totals.in)}</strong></span>
        <span>Egresos <strong className="tabular-nums text-foreground">{formatMoney(totals.out)}</strong></span>
        <span className="text-xs">(sin internos)</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Fecha</TableHead>
                <TableHead className="w-28">Cuenta</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="w-24">Ámbito</TableHead>
                <TableHead className="w-36 text-right">Monto</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No hay movimientos con estos filtros
                  </TableCell>
                </TableRow>
              )}
              {entries.map((entry) =>
                entry.type === 'single' ? (
                  renderRow(entry.tx)
                ) : (
                  <Fragment key={entry.key}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => {
                        const next = new Set(openGroups)
                        if (next.has(entry.key)) next.delete(entry.key)
                        else next.add(entry.key)
                        setOpenGroups(next)
                      }}
                    >
                      <TableCell className="whitespace-nowrap tabular-nums">{formatDate(entry.main.txDate)}</TableCell>
                      <TableCell className="whitespace-nowrap">{accountName.get(entry.main.accountId)}</TableCell>
                      <TableCell className="max-w-[360px]">
                        <div className="flex items-center gap-1 truncate font-mono text-xs">
                          {openGroups.has(entry.key) ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          {entry.main.descriptionRaw} + IVA
                          <span className="ml-1 font-sans text-muted-foreground">({entry.members.length} líneas)</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.members.some((m) => m.classification === 'pending') ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-300">{classificationLabels.pending}</Badge>
                        ) : (
                          [...new Set(entry.members.map((m) => (m.categoryId ? categoryName.get(m.categoryId) : '—')))].join(', ')
                        )}
                      </TableCell>
                      <TableCell>{entry.main.scope ? scopeLabels[entry.main.scope] : '—'}</TableCell>
                      <TableCell className={`text-right font-medium tabular-nums ${amountClass(entry.total)}`}>{formatMoney(entry.total)}</TableCell>
                      <TableCell />
                    </TableRow>
                    {openGroups.has(entry.key) && entry.members.map((m) => renderRow(m, true))}
                  </Fragment>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ClassifyDialog
        tx={editing}
        accountName={editing ? accountName.get(editing.accountId) : undefined}
        categories={categories}
        onOpenChange={(o) => !o && setEditing(null)}
      />
      <ManualTransactionDialog open={manualOpen} onOpenChange={setManualOpen} accounts={accounts} categories={categories} />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
