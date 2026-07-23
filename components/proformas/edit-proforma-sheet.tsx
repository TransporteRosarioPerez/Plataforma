'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Route, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FormSheet } from '@/components/ui/form-sheet'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { NumberInput } from '@/components/ui/number-input'
import { updateProforma } from '@/lib/actions/proformas'
import { generateProformaDownloadUrl, generateProformaUploadUrl } from '@/lib/actions/proforma-file'
import {
  formatTripLineAmount,
  parseTripLineAmount,
} from '@/lib/proformas/trip-estimate-amount'
import { calculateInvoiceAmounts } from '@/lib/invoices/calculate'
import type { Invoice, Proforma, Trip } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)

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

const initialState: ActionState = {}

type EditProformaSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proforma: Proforma | null
  invoice: Invoice | null
  trips: Trip[]
  onRequestDelete: (proforma: Proforma) => void
  canViewInvoices?: boolean
}

function buildAmountState(proforma: Proforma): Record<string, string> {
  const next: Record<string, string> = {}
  if (proforma.lineItems.length > 0) {
    for (const line of proforma.lineItems) {
      next[line.tripId] = formatTripLineAmount(line.amount)
    }
    return next
  }
  for (const tripId of proforma.tripIds) {
    next[tripId] = ''
  }
  return next
}

export function EditProformaSheet({
  open,
  onOpenChange,
  proforma,
  invoice,
  trips,
  onRequestDelete,
  canViewInvoices = false,
}: EditProformaSheetProps) {
  const router = useRouter()
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({})
  const [updateState, updateAction, updatePending] = useActionState(updateProforma, initialState)

  const canEditAmounts = Boolean(proforma && (proforma.lineItems.length > 0 || proforma.tripIds.length > 0))

  useEffect(() => {
    if (open && proforma) {
      setLineAmounts(buildAmountState(proforma))
    }
  }, [open, proforma])

  useEffect(() => {
    if (updateState.success) {
      toast.success(updateState.success)
      onOpenChange(false)
      router.refresh()
    }
    if (updateState.error) toast.error(updateState.error)
  }, [updateState, onOpenChange, router])

  const tripIds = useMemo(() => {
    if (!proforma) return []
    if (proforma.lineItems.length > 0) return proforma.lineItems.map((line) => line.tripId)
    return proforma.tripIds
  }, [proforma])

  const subtotal = useMemo(
    () => tripIds.reduce((sum, id) => sum + parseTripLineAmount(lineAmounts[id] ?? ''), 0),
    [tripIds, lineAmounts]
  )

  const lineItemsJson = useMemo(
    () =>
      JSON.stringify(
        tripIds.map((id) => ({
          trip_id: id,
          amount: parseTripLineAmount(lineAmounts[id] ?? ''),
          taxes: 0,
        }))
      ),
    [tripIds, lineAmounts]
  )

  const invoicePreview = useMemo(
    () => (invoice && canEditAmounts ? calculateInvoiceAmounts(subtotal) : null),
    [invoice, canEditAmounts, subtotal]
  )

  const handleDownloadPdf = async () => {
    if (!proforma) return
    setPdfDownloading(true)
    try {
      const result = await generateProformaDownloadUrl(proforma.id)
      if (result.error || !result.url) {
        toast.error(result.error ?? 'No se pudo descargar el PDF')
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setPdfDownloading(false)
    }
  }

  const handleReplacePdf = async (file: File) => {
    if (!proforma?.clientId) {
      toast.error('Cliente no disponible para subir PDF')
      return
    }
    setPdfUploading(true)
    try {
      const upload = await generateProformaUploadUrl(proforma.clientId, file.name)
      if (upload.error || !upload.uploadUrl || !upload.storageKey) {
        toast.error(upload.error ?? 'Error al preparar subida')
        return
      }
      const putRes = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      })
      if (!putRes.ok) {
        toast.error('Error al subir el PDF')
        return
      }
      const formData = new FormData()
      formData.set('id', proforma.id)
      formData.set('proforma_number', proforma.proformaNumber)
      formData.set('subtotal', String(proforma.subtotal))
      formData.set('received_date', proforma.receivedDate.toISOString().slice(0, 10))
      if (proforma.notes) formData.set('notes', proforma.notes)
      formData.set('file_url', upload.storageKey)
      formData.set('file_name', file.name)
      const result = await updateProforma({}, formData)
      if (result.error) toast.error(result.error)
      else {
        toast.success('PDF actualizado')
        router.refresh()
      }
    } finally {
      setPdfUploading(false)
    }
  }

  const editingTrips = proforma ? trips.filter((t) => proforma.tripIds.includes(t.id)) : []

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title="Editar proforma"
      description={proforma ? `${proforma.clientName} · Neto ${formatCurrency(subtotal || proforma.subtotal)}` : undefined}
      footer={
        proforma ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="destructive"
              className="sm:mr-auto"
              disabled={proforma.status !== 'pendiente'}
              onClick={() => {
                onOpenChange(false)
                onRequestDelete(proforma)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="edit-proforma-form" className="flex-1 sm:flex-none" disabled={updatePending}>
              Guardar
            </Button>
          </div>
        ) : null
      }
    >
      {proforma && (
        <form id="edit-proforma-form" action={updateAction} className="space-y-4">
          <input type="hidden" name="id" value={proforma.id} />
          <input type="hidden" name="subtotal" value={canEditAmounts ? subtotal : proforma.subtotal} />
          {canEditAmounts ? <input type="hidden" name="line_items" value={lineItemsJson} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Nº proforma *</FieldLabel>
              <Input
                name="proforma_number"
                defaultValue={proforma.proformaNumber}
                required
                disabled={updatePending}
              />
            </Field>
            <Field>
              <FieldLabel>Fecha recibida *</FieldLabel>
              <Input
                name="received_date"
                type="date"
                defaultValue={proforma.receivedDate.toISOString().slice(0, 10)}
                required
                disabled={updatePending}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Cliente</FieldLabel>
              <Input value={proforma.clientName} disabled />
            </Field>
            <Field>
              <FieldLabel>Estado</FieldLabel>
              <div className="flex h-9 items-center">
                <Badge variant="outline" className={statusColors[proforma.status]}>
                  {statusLabels[proforma.status]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {proforma.status === 'pendiente' && (
                  canViewInvoices
                    ? 'Creá la factura en el módulo Facturas.'
                    : 'Un administrador debe crear la factura en el módulo Facturas.'
                )}
                {proforma.status === 'facturada' && (
                  canViewInvoices
                    ? 'Marcá la factura como cobrada en Facturas.'
                    : 'Un administrador debe marcar la factura como cobrada.'
                )}
                {proforma.status === 'cobrada' && 'Cobrada vía factura — viajes en Pagado.'}
              </p>
            </Field>
          </div>

          {canViewInvoices && invoice && (
            <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-1 text-sm">
              <p className="font-medium">Factura vinculada</p>
              <p>
                <Link href="/app/facturas" className="font-mono underline">
                  {invoice.invoiceNumber}
                </Link>
                {' · '}
                {invoicePreview ? (
                  <>
                    Neto {formatCurrency(invoicePreview.subtotal)} + IVA{' '}
                    {formatCurrency(invoicePreview.iva)} = {formatCurrency(invoicePreview.total)}
                  </>
                ) : (
                  <>
                    Neto {formatCurrency(invoice.subtotal)} + IVA {formatCurrency(invoice.iva)} ={' '}
                    {formatCurrency(invoice.total)}
                  </>
                )}
              </p>
              {invoicePreview && invoicePreview.subtotal !== invoice.subtotal && (
                <p className="text-xs text-amber-800">
                  Al guardar se actualizará el neto, IVA y total de esta factura.
                </p>
              )}
            </div>
          )}

          <Field>
            <FieldLabel>PDF de la proforma</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {proforma.fileUrl ? (
                <>
                  <span className="max-w-[240px] truncate text-sm text-muted-foreground">
                    {proforma.fileName ?? 'proforma.pdf'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pdfDownloading || pdfUploading}
                    onClick={handleDownloadPdf}
                  >
                    {pdfDownloading ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-3.5 w-3.5" />
                    )}
                    Ver PDF
                  </Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Sin PDF cargado</span>
              )}
              <label>
                <Button type="button" variant="outline" size="sm" disabled={pdfUploading || updatePending} asChild>
                  <span>
                    {pdfUploading ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-3.5 w-3.5" />
                    )}
                    {proforma.fileUrl ? 'Reemplazar' : 'Subir PDF'}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  disabled={pdfUploading || updatePending}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleReplacePdf(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </Field>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <span className="text-sm text-muted-foreground">Neto (sin IVA)</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatCurrency(canEditAmounts ? subtotal : proforma.subtotal)}
            </span>
          </div>

          <Field>
            <FieldLabel>Viajes incluidos ({proforma.tripIds.length})</FieldLabel>
            {canEditAmounts && (proforma.lineItems.length > 0 || editingTrips.length > 0) ? (
              <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
                {(proforma.lineItems.length > 0
                  ? proforma.lineItems.map((line) => {
                      const trip = trips.find((t) => t.id === line.tripId)
                      return { tripId: line.tripId, code: trip?.code ?? line.tripId.slice(0, 8) }
                    })
                  : editingTrips.map((trip) => ({ tripId: trip.id, code: trip.code }))
                ).map(({ tripId, code }) => (
                  <div key={tripId} className="flex items-center gap-3 px-3 py-2.5">
                    <Link
                      href={`/app/viajes/${tripId}`}
                      className="font-mono text-sm hover:underline shrink-0"
                      onClick={() => onOpenChange(false)}
                    >
                      {code}
                    </Link>
                    <div className="ml-auto w-36">
                      <NumberInput
                        min={0}
                        decimals={2}
                        required
                        placeholder="0"
                        value={lineAmounts[tripId] ?? ''}
                        onValueChange={(v) =>
                          setLineAmounts((prev) => ({
                            ...prev,
                            [tripId]: formatTripLineAmount(v),
                          }))
                        }
                        disabled={updatePending}
                        className="h-9 text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {proforma.lineItems.length > 0 ? (
                  proforma.lineItems.map((line) => {
                    const trip = trips.find((t) => t.id === line.tripId)
                    return (
                      <li key={line.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <Link
                          href={`/app/viajes/${line.tripId}`}
                          className="font-mono hover:underline"
                          onClick={() => onOpenChange(false)}
                        >
                          {trip?.code ?? line.tripId.slice(0, 8)}
                        </Link>
                        <span className="text-xs text-muted-foreground">{formatCurrency(line.amount)}</span>
                      </li>
                    )
                  })
                ) : editingTrips.length > 0 ? (
                  editingTrips.map((trip) => (
                    <li key={trip.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <Link
                        href={`/app/viajes/${trip.id}`}
                        className="flex items-center gap-2 hover:underline"
                        onClick={() => onOpenChange(false)}
                      >
                        <Route className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono">{trip.code}</span>
                      </Link>
                      <span className="text-muted-foreground">
                        {trip.totalIncome > 0 ? formatCurrency(trip.totalIncome) : '—'}
                      </span>
                    </li>
                  ))
                ) : (
                  proforma.tripIds.map((id) => (
                    <li key={id} className="px-3 py-2 text-sm font-mono text-muted-foreground">
                      {id.slice(0, 8)}
                    </li>
                  ))
                )}
              </ul>
            )}
            {canEditAmounts && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Podés ajustar el importe neto de cada viaje. El neto de la proforma se recalcula solo
                {invoice ? ' y también el de la factura vinculada (IVA 21%)' : ''}.
              </p>
            )}
          </Field>

          <Field>
            <FieldLabel>Notas</FieldLabel>
            <Textarea
              name="notes"
              rows={2}
              defaultValue={proforma.notes ?? ''}
              disabled={updatePending}
            />
          </Field>
        </form>
      )}
    </FormSheet>
  )
}
