'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, FileText, Pencil, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { CreateProformaSheet } from '@/components/proformas/create-proforma-sheet'
import { EditProformaSheet } from '@/components/proformas/edit-proforma-sheet'
import { deleteProforma } from '@/lib/actions/proformas'
import { OPERATIONAL_TRIP_STATUSES, type Proforma, Client, Trip, Invoice } from '@/lib/types'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const statusLabels: Record<Proforma['status'], string> = {
  pendiente: 'Pendiente',
  facturada: 'Facturada',
  cobrada: 'Cobrada',
}

const statusColors: Record<Proforma['status'], string> = {
  pendiente: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  facturada: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  cobrada: 'bg-green-500/10 text-green-700 border-green-500/30',
}

const PAGE_SIZES = [25, 50, 100] as const
type StatusFilter = Proforma['status'] | 'all'

function getAssignedTripIds(proformas: Proforma[], excludeProformaId?: string): Set<string> {
  const ids = new Set<string>()
  for (const p of proformas) {
    if (excludeProformaId && p.id === excludeProformaId) continue
    if (p.status === 'pendiente' || p.status === 'facturada') {
      p.tripIds.forEach((id) => ids.add(id))
    }
  }
  return ids
}

type ProformasViewProps = {
  proformas: Proforma[]
  clients: Client[]
  trips: Trip[]
  invoicesByProformaId: Record<string, Invoice>
  canViewInvoices?: boolean
}

export function ProformasView({
  proformas,
  clients,
  trips,
  invoicesByProformaId,
  canViewInvoices = false,
}: ProformasViewProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pageSize, setPageSize] = useState<number>(25)
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Proforma | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Proforma | null>(null)

  const assignedTripIds = useMemo(() => getAssignedTripIds(proformas), [proformas])

  const billableTrips = useMemo(() => {
    return trips
      .filter(
        (t) =>
          OPERATIONAL_TRIP_STATUSES.includes(t.status) && !assignedTripIds.has(t.id)
      )
      .sort((a, b) => {
        const da = a.departureDate?.getTime() ?? a.createdAt.getTime()
        const db = b.departureDate?.getTime() ?? b.createdAt.getTime()
        return db - da
      })
  }, [trips, assignedTripIds])

  const editBillableTrips = useMemo(() => {
    if (!editing) return billableTrips
    const assignedElsewhere = getAssignedTripIds(proformas, editing.id)
    return trips
      .filter(
        (t) =>
          editing.tripIds.includes(t.id) ||
          (OPERATIONAL_TRIP_STATUSES.includes(t.status) && !assignedElsewhere.has(t.id))
      )
      .sort((a, b) => {
        const da = a.departureDate?.getTime() ?? a.createdAt.getTime()
        const db = b.departureDate?.getTime() ?? b.createdAt.getTime()
        return db - da
      })
  }, [billableTrips, editing, proformas, trips])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return proformas.filter((p) => {
      const matchSearch =
        !search ||
        p.proformaNumber.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [proformas, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageItems = filtered.slice(pageStart, pageStart + pageSize)

  const openEdit = (proforma: Proforma) => {
    setEditing(proforma)
    setEditOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    const result = await deleteProforma(toDelete.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      router.refresh()
    }
    setDeleteOpen(false)
    setToDelete(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proformas</h1>
          <p className="text-muted-foreground">
            Proformas a tus clientes reales con importes netos (sin IVA). Facturá en el módulo Facturas;
            el cobro se registra al marcar la factura como Cobrada.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva proforma
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Listado</CardTitle>
              <CardDescription>{filtered.length} proformas</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-2">
                {(['all', 'pendiente', 'facturada', 'cobrada'] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={statusFilter === s ? 'default' : 'outline'}
                    onClick={() => { setStatusFilter(s); setPage(1) }}
                  >
                    {s === 'all' ? 'Todas' : statusLabels[s]}
                  </Button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar nº o cliente..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No hay proformas registradas</p>
              <Button variant="link" onClick={() => setCreateOpen(true)}>Crear la primera</Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Proforma</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Recibida</TableHead>
                    <TableHead className="text-center">Viajes</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => openEdit(p)}
                    >
                      <TableCell className="font-mono font-medium">{p.proformaNumber}</TableCell>
                      <TableCell>{p.clientName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {dateFormatter.format(p.receivedDate)}
                      </TableCell>
                      <TableCell className="text-center">{p.tripIds.length}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(p.subtotal)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[p.status]}>
                          {statusLabels[p.status]}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} de {filtered.length}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>{s} / pág</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm tabular-nums">{safePage} / {totalPages}</span>
                  <Button variant="outline" size="icon" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CreateProformaSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        clients={clients}
        billableTrips={billableTrips}
        allTrips={trips}
      />

      <EditProformaSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        proforma={editing}
        invoice={editing ? invoicesByProformaId[editing.id] ?? null : null}
        billableTrips={editBillableTrips}
        allTrips={trips}
        onRequestDelete={(p) => {
          setToDelete(p)
          setDeleteOpen(true)
        }}
        canViewInvoices={canViewInvoices}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja esta proforma?</AlertDialogTitle>
            <AlertDialogDescription>
              La proforma {toDelete?.proformaNumber} dejará de aparecer en listados y los viajes volverán a estado operativo. Podés recuperarla desde Papelera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
