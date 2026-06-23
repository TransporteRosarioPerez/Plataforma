'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Link2, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteFuelTransaction } from '@/lib/actions/fuel-import'
import type { FuelTransaction, FuelProvider, FuelMatchStatus } from '@/lib/types'
import { LinkFuelTripDialog } from '@/components/fuel/link-fuel-trip-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const providerLabels: Record<FuelProvider, string> = {
  ypf: 'YPF',
  shell: 'Shell',
}

const statusLabels: Record<FuelMatchStatus, string> = {
  linked: 'Vinculado',
  unlinked: 'Sin viaje',
  ambiguous: 'Ambiguo',
}

type FuelTransactionsTableProps = {
  transactions: FuelTransaction[]
  trips: { id: string; code: string; vehiclePlate?: string; trailerPlate?: string }[]
  showActions?: boolean
}

export function FuelTransactionsTable({
  transactions,
  trips,
  showActions = true,
}: FuelTransactionsTableProps) {
  const router = useRouter()
  const [providerFilter, setProviderFilter] = useState<FuelProvider | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<FuelMatchStatus | 'all'>('all')
  const [linkTarget, setLinkTarget] = useState<FuelTransaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FuelTransaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (providerFilter !== 'all' && t.provider !== providerFilter) return false
      if (statusFilter !== 'all' && t.matchStatus !== statusFilter) return false
      return true
    })
  }, [transactions, providerFilter, statusFilter])

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
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value as FuelProvider | 'all')}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="all">Todos los proveedores</option>
          <option value="ypf">YPF</option>
          <option value="shell">Shell</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FuelMatchStatus | 'all')}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="linked">Vinculados</option>
          <option value="unlinked">Sin viaje</option>
          <option value="ambiguous">Ambiguos</option>
        </select>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Patente</TableHead>
              <TableHead>Estación</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Litros</TableHead>
              <TableHead className="text-right">Neto</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Viaje</TableHead>
              <TableHead>Estado</TableHead>
              {showActions && <TableHead className="w-[100px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions ? 11 : 10} className="text-center text-muted-foreground py-8">
                  No hay cargas de combustible
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className={cn(
                    t.matchStatus === 'unlinked' && 'bg-destructive/10 hover:bg-destructive/15',
                    t.matchStatus === 'ambiguous' && 'bg-amber-500/10 hover:bg-amber-500/15'
                  )}
                >
                  <TableCell className="whitespace-nowrap text-sm">
                    {dateFormatter.format(t.transactionAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{providerLabels[t.provider]}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{t.plate}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm" title={t.stationName}>
                    {t.stationName ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-sm" title={t.product}>
                    {t.product ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {t.liters > 0 ? t.liters.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(t.amountNet)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(t.amountTotal)}</TableCell>
                  <TableCell>
                    {t.tripId && t.tripCode ? (
                      <Link href={`/app/viajes/${t.tripId}`} className="text-sm font-mono text-primary hover:underline">
                        {t.tripCode}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={t.matchStatus === 'linked' ? 'secondary' : 'destructive'}
                      className={cn(
                        t.matchStatus === 'ambiguous' && 'bg-amber-500/20 text-amber-900 border-amber-500/30 hover:bg-amber-500/20'
                      )}
                    >
                      {statusLabels[t.matchStatus]}
                    </Badge>
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex gap-1">
                        {t.matchStatus !== 'linked' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Vincular viaje"
                            onClick={() => setLinkTarget(t)}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Eliminar"
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
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
              Se dará de baja la transacción de combustible
              {deleteTarget?.tripCode ? ` vinculada a ${deleteTarget.tripCode}` : ''}.
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
