'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Link2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LinkFuelTripDialog } from '@/components/fuel/link-fuel-trip-dialog'
import { deleteFuelTransaction } from '@/lib/actions/fuel'
import { hasPrice, pricePerLiter } from '@/lib/fuel/report'
import { normalizePlate } from '@/lib/fuel/resolve'
import type { FuelTransaction } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatArs, formatDate, formatPricePerLiter, paymentMethodLabels } from '@/components/fuel/format'

type FuelTransactionsTableProps = {
  transactions: FuelTransaction[]
  trips: { id: string; code: string; vehiclePlate?: string; trailerPlate?: string }[]
  onEdit: (t: FuelTransaction) => void
}

export function FuelTransactionsTable({ transactions, trips, onEdit }: FuelTransactionsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [onlyPending, setOnlyPending] = useState(false)
  const [linkTarget, setLinkTarget] = useState<FuelTransaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FuelTransaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase()
    const qPlate = normalizePlate(search)
    return transactions.filter((t) => {
      if (onlyPending && hasPrice(t)) return false
      if (!q) return true
      return normalizePlate(t.plate).includes(qPlate) || (t.driverName ?? '').toUpperCase().includes(q)
    })
  }, [transactions, search, onlyPending])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteFuelTransaction(deleteTarget.id)
    setDeleting(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      setDeleteTarget(null)
      router.refresh()
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar patente o chofer"
          className="h-9 w-full sm:w-64"
        />
        <div className="flex items-center gap-2">
          <Switch id="fuel-only-pending" checked={onlyPending} onCheckedChange={setOnlyPending} />
          <Label htmlFor="fuel-only-pending" className="text-sm font-normal">Solo sin precio</Label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Patente</TableHead>
              <TableHead>Chofer</TableHead>
              <TableHead className="text-right">Litros</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">$ / litro</TableHead>
              <TableHead className="text-right">Km</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Viaje</TableHead>
              <TableHead className="w-[120px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  No hay cargas para mostrar
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => {
                const ppl = pricePerLiter(t)
                return (
                  <TableRow key={t.id} className={cn(!ppl && 'bg-amber-500/10 hover:bg-amber-500/15')}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(t.transactionAt)}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-sm">
                      {t.plate}
                      {!t.vehicleId && (
                        <Badge variant="outline" className="ml-2 text-[10px]" title="La patente no está cargada en Vehículos">
                          fuera de flota
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm" title={t.driverName}>
                      {t.driverName ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {t.liters.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">
                      {ppl ? formatArs(t.amountTotal) : <span className="text-amber-700 dark:text-amber-400">Sin precio</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{ppl ? formatPricePerLiter(ppl) : '—'}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {t.odometerKm != null ? t.odometerKm.toLocaleString('es-AR') : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {t.paymentMethod ? paymentMethodLabels[t.paymentMethod] : '—'}
                    </TableCell>
                    <TableCell>
                      {t.tripId && t.tripCode ? (
                        <Link href={`/app/viajes/${t.tripId}`} className="font-mono text-sm text-primary hover:underline">
                          {t.tripCode}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {t.matchStatus === 'ambiguous' ? 'Varios' : '—'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => onEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Vincular a un viaje" onClick={() => setLinkTarget(t)}>
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setDeleteTarget(t)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {linkTarget && (
        <LinkFuelTripDialog
          transaction={linkTarget}
          trips={trips}
          open={!!linkTarget}
          onOpenChange={(open) => !open && setLinkTarget(null)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta carga?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `${deleteTarget.plate} · ${formatDate(deleteTarget.transactionAt)} · ${deleteTarget.liters} L`}
              {deleteTarget?.tripCode ? `. Se descuenta del viaje ${deleteTarget.tripCode}.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
