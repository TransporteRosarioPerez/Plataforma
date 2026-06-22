'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Route, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormSheet } from '@/components/ui/form-sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { updateProforma } from '@/lib/actions/proformas'
import { generateProformaDownloadUrl, generateProformaUploadUrl } from '@/lib/actions/proforma-file'
import type { Proforma, Trip } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const initialState: ActionState = {}

type EditProformaSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proforma: Proforma | null
  trips: Trip[]
  onRequestDelete: (proforma: Proforma) => void
}

export function EditProformaSheet({
  open,
  onOpenChange,
  proforma,
  trips,
  onRequestDelete,
}: EditProformaSheetProps) {
  const router = useRouter()
  const [editStatus, setEditStatus] = useState<Proforma['status']>('pendiente')
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [updateState, updateAction, updatePending] = useActionState(updateProforma, initialState)

  useEffect(() => {
    if (proforma) setEditStatus(proforma.status)
  }, [proforma])

  useEffect(() => {
    if (updateState.success) {
      toast.success(updateState.success)
      onOpenChange(false)
      router.refresh()
    }
    if (updateState.error) toast.error(updateState.error)
  }, [updateState, onOpenChange, router])

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
      formData.set('taxes', String(proforma.taxes))
      formData.set('total', String(proforma.total))
      formData.set('status', editStatus)
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
      description={proforma ? `${proforma.clientName} · ${formatCurrency(proforma.total)}` : undefined}
      footer={
        proforma ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="destructive"
              className="sm:mr-auto"
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
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as Proforma['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="facturada">Facturada</SelectItem>
                  <SelectItem value="cobrada">Cobrada (marca viajes como pagados)</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="status" value={editStatus} />
            </Field>
          </div>

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
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums">{formatCurrency(proforma.total)}</span>
          </div>
          <input type="hidden" name="subtotal" value={proforma.subtotal} />
          <input type="hidden" name="taxes" value={proforma.taxes} />
          <input type="hidden" name="total" value={proforma.total} />

          <Field>
            <FieldLabel>Viajes incluidos ({proforma.tripIds.length})</FieldLabel>
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
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(line.amount)} + IVA {formatCurrency(line.taxes)}
                      </span>
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
