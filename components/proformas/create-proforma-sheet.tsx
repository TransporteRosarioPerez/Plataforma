'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/components/ui/form-sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Field, FieldLabel } from '@/components/ui/field'
import { AddTripsDialog } from '@/components/proformas/add-trips-dialog'
import { SelectedTripsEditor } from '@/components/proformas/selected-trips-editor'
import {
  buildTripLineFromEstimate,
  type TripLineValues,
} from '@/lib/proformas/trip-estimate-amount'
import { createProforma } from '@/lib/actions/proformas'
import { appendProformaFileToFormData } from '@/lib/documents/upload-proforma-file'
import type { Client, Trip } from '@/lib/types'
import { toast } from 'sonner'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

const PROFORMA_STEPS = [
  { id: 1, label: 'Datos' },
  { id: 2, label: 'Viajes' },
]

type CreateProformaSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: Client[]
  billableTrips: Trip[]
  allTrips: Trip[]
}

export function CreateProformaSheet({
  open,
  onOpenChange,
  clients,
  billableTrips,
  allTrips,
}: CreateProformaSheetProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [pending, setPending] = useState(false)

  const [clientId, setClientId] = useState('')
  const [proformaNumber, setProformaNumber] = useState('')
  const [receivedDate, setReceivedDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([])
  const [tripLines, setTripLines] = useState<Record<string, TripLineValues>>({})
  const [addTripsOpen, setAddTripsOpen] = useState(false)

  const resetForm = () => {
    setStep(1)
    setClientId(clients[0]?.id ?? '')
    setProformaNumber('')
    setReceivedDate(todayIso())
    setNotes('')
    setPdfFile(null)
    setSelectedTripIds([])
    setTripLines({})
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    else if (!clientId && clients[0]) setClientId(clients[0].id)
    onOpenChange(next)
  }

  const taxesNum = useMemo(
    () => selectedTripIds.reduce((sum, id) => sum + (Number(tripLines[id]?.taxes) || 0), 0),
    [selectedTripIds, tripLines]
  )

  const subtotal = useMemo(
    () => selectedTripIds.reduce((sum, id) => sum + (Number(tripLines[id]?.amount) || 0), 0),
    [selectedTripIds, tripLines]
  )

  const total = subtotal + taxesNum

  const lineItemsJson = useMemo(
    () =>
      JSON.stringify(
        selectedTripIds.map((id) => ({
          trip_id: id,
          amount: Number(tripLines[id]?.amount ?? 0),
          taxes: Number(tripLines[id]?.taxes ?? 0),
        }))
      ),
    [selectedTripIds, tripLines]
  )

  const canGoNext = !!clientId && !!proformaNumber.trim() && !!receivedDate

  const getTrip = (tripId: string) => allTrips.find((t) => t.id === tripId)

  const toggleTrip = (tripId: string) => {
    setSelectedTripIds((prev) => {
      if (prev.includes(tripId)) {
        setTripLines((lines) => {
          const next = { ...lines }
          delete next[tripId]
          return next
        })
        return prev.filter((id) => id !== tripId)
      }
      const trip = getTrip(tripId)
      setTripLines((lines) => ({
        ...lines,
        [tripId]: trip ? buildTripLineFromEstimate(trip) : { amount: '', taxes: '0' },
      }))
      return [...prev, tripId]
    })
  }

  const updateTripLine = (tripId: string, field: 'amount' | 'taxes', value: string) => {
    setTripLines((lines) => ({
      ...lines,
      [tripId]: {
        amount: field === 'amount' ? value : lines[tripId]?.amount ?? '',
        taxes: field === 'taxes' ? value : lines[tripId]?.taxes ?? '0',
        fromEstimate: field === 'amount' ? false : lines[tripId]?.fromEstimate,
      },
    }))
  }

  const confirmTripSelection = (tripIds: string[]) => {
    setSelectedTripIds(tripIds)
    setTripLines((lines) => {
      const next = { ...lines }
      for (const id of tripIds) {
        if (!next[id]) {
          const trip = getTrip(id)
          next[id] = trip ? buildTripLineFromEstimate(trip) : { amount: '', taxes: '0' }
        }
      }
      for (const id of Object.keys(next)) {
        if (!tripIds.includes(id)) delete next[id]
      }
      return next
    })
  }

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Solo se permiten archivos PDF')
      return
    }
    setPdfFile(file)
  }

  const handleCreate = async () => {
    if (!clientId || selectedTripIds.length === 0) return

    setPending(true)
    try {
      const formData = new FormData()
      formData.set('client_id', clientId)
      formData.set('proforma_number', proformaNumber.trim())
      formData.set('received_date', receivedDate)
      formData.set('line_items', lineItemsJson)
      if (notes.trim()) formData.set('notes', notes.trim())

      if (pdfFile) {
        const upload = await appendProformaFileToFormData(formData, clientId, pdfFile)
        if (!upload.ok) {
          toast.error(upload.error)
          return
        }
      }

      const result = await createProforma({}, formData)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.success)
      handleOpenChange(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={handleOpenChange}
        size="wide"
        title="Nueva proforma"
        description={
          step === 1
            ? 'Datos de la proforma y PDF recibido.'
            : 'Elegí viajes e ingresá el importe de cada uno.'
        }
        steps={PROFORMA_STEPS}
        currentStep={step}
        footer={
          <>
            {step === 2 && (
              <div className="mb-3 flex w-full items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {selectedTripIds.length === 0
                    ? 'Sin viajes'
                    : `${selectedTripIds.length} viaje${selectedTripIds.length === 1 ? '' : 's'}`}
                </span>
                <span className="text-base font-semibold tabular-nums">{formatCurrency(total)}</span>
              </div>
            )}
            <div className="flex w-full gap-2">
              {step === 2 ? (
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)} disabled={pending}>
                  Atrás
                </Button>
              ) : (
                <Button type="button" variant="outline" className="flex-1" onClick={() => handleOpenChange(false)} disabled={pending}>
                  Cancelar
                </Button>
              )}
              {step === 1 ? (
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!canGoNext || pending}
                  onClick={() => setStep(2)}
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  type="button"
                  className="flex-1"
                  disabled={pending || selectedTripIds.length === 0}
                  onClick={handleCreate}
                >
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear proforma
                </Button>
              )}
            </div>
          </>
        }
      >
        <div className="space-y-4">
          {step === 1 ? (
            <>
              <Field>
                <FieldLabel>Cliente *</FieldLabel>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clients.length === 0 && (
                  <p className="text-xs text-destructive mt-1">
                    Cargá clientes en{' '}
                    <Link href="/app/clientes" className="underline">Clientes</Link>.
                  </p>
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Nº proforma *</FieldLabel>
                  <Input
                    value={proformaNumber}
                    onChange={(e) => setProformaNumber(e.target.value)}
                    placeholder="Ej. PF-2026-001"
                    disabled={pending}
                  />
                </Field>
                <Field>
                  <FieldLabel>Fecha recibida *</FieldLabel>
                  <Input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    disabled={pending}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel>PDF de la proforma</FieldLabel>
                {pdfFile ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm truncate flex-1">{pdfFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setPdfFile(null)}
                      disabled={pending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center hover:bg-muted/30 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Tocá para subir el PDF recibido</span>
                    <span className="text-xs text-muted-foreground">Opcional · solo PDF</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={handlePdfChange}
                      disabled={pending}
                    />
                  </label>
                )}
              </Field>

              <Field>
                <FieldLabel>Notas</FieldLabel>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Observaciones internas…"
                  disabled={pending}
                />
              </Field>
            </>
          ) : (
            <SelectedTripsEditor
              trips={allTrips}
              selectedTripIds={selectedTripIds}
              tripLines={tripLines}
              onRemoveTrip={toggleTrip}
              onUpdateLine={updateTripLine}
              onAddTrips={() => setAddTripsOpen(true)}
              disabled={pending}
            />
          )}
        </div>
      </FormSheet>

      <AddTripsDialog
        open={addTripsOpen}
        onOpenChange={setAddTripsOpen}
        trips={billableTrips}
        selectedTripIds={selectedTripIds}
        tripLines={tripLines}
        onConfirm={confirmTripSelection}
      />
    </>
  )
}
