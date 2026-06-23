'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Receipt, Download, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CreateInvoiceSheet } from '@/components/facturas/create-invoice-sheet'
import { markInvoicePaid, deleteInvoice } from '@/lib/actions/invoices'
import { generateInvoiceDownloadUrl } from '@/lib/actions/invoice-file'
import type { Invoice, Proforma } from '@/lib/types'
import { toast } from 'sonner'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const statusLabels: Record<Invoice['status'], string> = {
  emitida: 'Emitida',
  cobrada: 'Cobrada',
  anulada: 'Anulada',
}

const statusColors: Record<Invoice['status'], string> = {
  emitida: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  cobrada: 'bg-green-500/10 text-green-700 border-green-500/30',
  anulada: 'bg-red-500/10 text-red-700 border-red-500/30',
}

type FacturasViewProps = {
  invoices: Invoice[]
  proformas: Proforma[]
  invoicedProformaIds: string[]
}

export function FacturasView({ invoices, proformas, invoicedProformaIds }: FacturasViewProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Invoice | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)

  const proformaById = useMemo(() => new Map(proformas.map((p) => [p.id, p])), [proformas])
  const invoicedIds = useMemo(() => new Set(invoicedProformaIds), [invoicedProformaIds])

  const billableProformas = useMemo(
    () => proformas.filter((p) => p.status === 'pendiente' && !invoicedIds.has(p.id)),
    [proformas, invoicedIds]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return invoices.filter((inv) => {
      const proforma = inv.proformaId ? proformaById.get(inv.proformaId) : undefined
      return (
        !search ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        (proforma?.proformaNumber.toLowerCase().includes(q) ?? false)
      )
    })
  }, [invoices, search, proformaById])

  const handleMarkPaid = async (invoice: Invoice) => {
    setPayingId(invoice.id)
    const result = await markInvoicePaid(invoice.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      router.refresh()
    }
    setPayingId(null)
  }

  const handleDownload = async (invoice: Invoice) => {
    setDownloadingId(invoice.id)
    try {
      const result = await generateInvoiceDownloadUrl(invoice.id)
      if (result.error || !result.url) {
        toast.error(result.error ?? 'No se pudo descargar el PDF')
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    const result = await deleteInvoice(toDelete.id)
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
          <h1 className="text-2xl font-bold tracking-tight">Facturas</h1>
          <p className="text-muted-foreground">
            Una factura por proforma. El IVA 21% se calcula sobre el neto total. El cobro se registra acá.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva factura
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Listado</CardTitle>
              <CardDescription>{filtered.length} facturas</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar nº, cliente o proforma..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No hay facturas registradas</p>
              <Button variant="link" onClick={() => setCreateOpen(true)}>Crear la primera</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Factura</TableHead>
                  <TableHead>Proforma</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const proforma = inv.proformaId ? proformaById.get(inv.proformaId) : undefined
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {proforma?.proformaNumber ?? '—'}
                      </TableCell>
                      <TableCell>{inv.clientName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {dateFormatter.format(inv.issueDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(inv.subtotal)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(inv.iva)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(inv.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[inv.status]}>
                          {statusLabels[inv.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {inv.fileUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={downloadingId === inv.id}
                              onClick={() => handleDownload(inv)}
                              aria-label="Ver PDF"
                            >
                              {downloadingId === inv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {inv.status === 'emitida' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={payingId === inv.id}
                              onClick={() => handleMarkPaid(inv)}
                            >
                              {payingId === inv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Cobrada'
                              )}
                            </Button>
                          )}
                          {inv.status === 'emitida' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setToDelete(inv)
                                setDeleteOpen(true)
                              }}
                              aria-label="Dar de baja"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateInvoiceSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        billableProformas={billableProformas}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja esta factura?</AlertDialogTitle>
            <AlertDialogDescription>
              La proforma volverá a Pendiente. Podés recuperar la factura desde Papelera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Dar de baja</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
