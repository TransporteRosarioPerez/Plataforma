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
import { AddSharedTripDialog } from '@/components/proformas/add-shared-trip-dialog'
import { AddAdjustmentTripsDialog } from '@/components/proformas/add-adjustment-trips-dialog'
import { SelectedTripsEditor } from '@/components/proformas/selected-trips-editor'
import { ProformaPdfCheck } from '@/components/proformas/proforma-pdf-check'
import {
  buildAdjustmentLine,
  buildLineItemsJson,
  buildTripLineFromEstimate,
  formatTripLineAmount,
  signedTripLineAmount,
  sumTripLines,
  type TripBillingHistoryEntry,
  type TripLineAdjustment,
  type TripLineValues,
} from '@/lib/proformas/trip-estimate-amount'
import type { SharedTripLookup } from '@/lib/actions/proformas'
import { createProforma } from '@/lib/actions/proformas'
import { matchProformaPdf } from '@/lib/actions/proforma-pdf'
import {
  looksLikeArcorProforma,
  parseArcorProforma,
  type ArcorProformaGroup,
} from '@/lib/proformas/parse-arcor-pdf'
import { reviewProformaPdf, type TripMatch } from '@/lib/proformas/pdf-review'
import { roundCents } from '@/lib/pdf/numbers'
import { readPdfLines } from '@/lib/pdf/read-pdf-lines'
import { appendProformaFileToFormData } from '@/lib/documents/upload-proforma-file'
import type { Client, Trip } from '@/lib/types'
import { toast } from 'sonner'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

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
  adjustableTrips: Trip[]
  tripBillingHistory: Record<string, TripBillingHistoryEntry[]>
  allTrips: Trip[]
}

export function CreateProformaSheet({
  open,
  onOpenChange,
  clients,
  billableTrips,
  adjustableTrips,
  tripBillingHistory,
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

  // Lectura del PDF de Arcor: si se pudo leer, el PDF manda y hay que revisarlo antes de guardar
  const [pdfReading, setPdfReading] = useState(false)
  const [pdfGroups, setPdfGroups] = useState<ArcorProformaGroup[]>([])
  const [pdfGroup, setPdfGroup] = useState<ArcorProformaGroup | null>(null)
  const [pdfMatches, setPdfMatches] = useState<Record<string, TripMatch | null>>({})
  const [pdfReviewed, setPdfReviewed] = useState(false)

  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([])
  const [tripLines, setTripLines] = useState<Record<string, TripLineValues>>({})
  const [sharedTripIds, setSharedTripIds] = useState<Set<string>>(() => new Set())
  const [addTripsOpen, setAddTripsOpen] = useState(false)
  const [addSharedOpen, setAddSharedOpen] = useState(false)
  const [addAdjustmentOpen, setAddAdjustmentOpen] = useState(false)

  const resetForm = () => {
    setStep(1)
    setClientId(clients[0]?.id ?? '')
    setProformaNumber('')
    setReceivedDate(todayIso())
    setNotes('')
    setPdfFile(null)
    clearPdfImport()
    setSelectedTripIds([])
    setTripLines({})
    setSharedTripIds(new Set())
  }

  function clearPdfImport() {
    setPdfGroups([])
    setPdfGroup(null)
    setPdfMatches({})
    setPdfReviewed(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    else if (!clientId && clients[0]) setClientId(clients[0].id)
    onOpenChange(next)
  }

  const subtotal = useMemo(
    () => sumTripLines(selectedTripIds, tripLines),
    [selectedTripIds, tripLines]
  )

  const total = subtotal

  const lineItemsJson = useMemo(
    () => buildLineItemsJson(selectedTripIds, tripLines),
    [selectedTripIds, tripLines]
  )

  const pdfReview = useMemo(() => {
    if (!pdfGroup) return null
    const amounts = new Map(
      selectedTripIds.map((id) => [id, roundCents(signedTripLineAmount(tripLines[id]))] as const)
    )
    return reviewProformaPdf(pdfGroup, pdfMatches, amounts)
  }, [pdfGroup, pdfMatches, selectedTripIds, tripLines])

  const pdfBlocksSave = !!pdfGroup && !(pdfReview?.ok && pdfReviewed)

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
        setSharedTripIds((shared) => {
          const next = new Set(shared)
          next.delete(tripId)
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

  const updateTripLine = (tripId: string, value: string) => {
    setTripLines((lines) => ({
      ...lines,
      [tripId]: {
        ...lines[tripId],
        amount: value,
        taxes: '0',
        fromEstimate: false,
      },
    }))
  }

  const updateAdjustment = (tripId: string, patch: Partial<TripLineAdjustment>) => {
    setTripLines((lines) => {
      const current = lines[tripId]
      if (!current?.adjustment) return lines
      return { ...lines, [tripId]: { ...current, adjustment: { ...current.adjustment, ...patch } } }
    })
  }

  const confirmAdjustmentTrips = (tripIds: string[]) => {
    setSelectedTripIds((prev) => [...prev, ...tripIds.filter((id) => !prev.includes(id))])
    setTripLines((lines) => {
      const next = { ...lines }
      for (const id of tripIds) {
        if (!next[id]) next[id] = buildAdjustmentLine()
      }
      return next
    })
  }

  const confirmTripSelection = (pickedTripIds: string[]) => {
    // “Elegir viajes” no toca las líneas de ajuste: se conservan siempre
    const adjustmentIds = selectedTripIds.filter((id) => tripLines[id]?.adjustment)
    const tripIds = [...pickedTripIds, ...adjustmentIds.filter((id) => !pickedTripIds.includes(id))]
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
    setSharedTripIds((shared) => {
      const next = new Set<string>()
      for (const id of shared) {
        if (tripIds.includes(id)) next.add(id)
      }
      return next
    })
  }

  const confirmSharedTrip = (shared: SharedTripLookup) => {
    setSelectedTripIds((prev) => (prev.includes(shared.tripId) ? prev : [...prev, shared.tripId]))
    setSharedTripIds((prev) => new Set(prev).add(shared.tripId))
    setTripLines((lines) => {
      if (lines[shared.tripId]) return lines
      const trip = getTrip(shared.tripId)
      return {
        ...lines,
        [shared.tripId]: trip ? buildTripLineFromEstimate(trip) : { amount: '', taxes: '0' },
      }
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
    clearPdfImport()
    void readProformaPdf(file)
  }

  const removePdf = () => {
    setPdfFile(null)
    clearPdfImport()
  }

  /** Lee el PDF en el navegador y, si es una proforma de Arcor, la arma sola. */
  const readProformaPdf = async (file: File) => {
    setPdfReading(true)
    try {
      const pages = await readPdfLines(file)
      if (!looksLikeArcorProforma(pages)) {
        toast.info('El PDF no tiene el formato de proforma de Arcor: elegí los viajes a mano.')
        return
      }
      const parsed = parseArcorProforma(pages)
      if (parsed.errors.length > 0) toast.warning(parsed.errors.slice(0, 3).join(' · '))
      setPdfGroups(parsed.groups)
      if (parsed.groups.length === 1) await applyPdfGroup(parsed.groups[0])
    } catch {
      toast.error('No se pudo leer el PDF. Podés cargar los viajes a mano.')
    } finally {
      setPdfReading(false)
    }
  }

  /** Busca los viajes por número de carga y completa la proforma con los importes del PDF. */
  const applyPdfGroup = async (group: ArcorProformaGroup) => {
    setPdfReading(true)
    try {
      const res = await matchProformaPdf({
        proformaNumber: group.proformaNumber,
        cuit: group.cuit,
        codes: group.rows.map((r) => r.code),
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.existingProformaNumber) {
        toast.warning(`Ya existe la proforma ${res.existingProformaNumber}: revisá que no se esté cargando dos veces.`)
      }

      setPdfGroup(group)
      setPdfMatches(res.matches)
      setPdfReviewed(false)
      setProformaNumber(group.proformaNumber)
      const matchedClientId =
        res.clientId ?? clients.find((c) => c.cuit?.replace(/\D/g, '') === group.cuit)?.id
      if (matchedClientId) setClientId(matchedClientId)
      if (group.issueDate) setReceivedDate(group.issueDate)

      const byTrip = new Map<string, { amount: number; match: TripMatch }>()
      for (const row of group.rows) {
        const match = res.matches[row.code]
        if (!match || match.kind === 'not_billable') continue
        const prev = byTrip.get(match.tripId)
        byTrip.set(match.tripId, { amount: roundCents((prev?.amount ?? 0) + row.amount), match })
      }

      const lines: Record<string, TripLineValues> = {}
      const shared = new Set<string>()
      for (const [tripId, { amount, match }] of byTrip) {
        if (match.kind === 'adjustment') {
          lines[tripId] = {
            amount: formatTripLineAmount(Math.abs(amount)),
            taxes: '0',
            adjustment: {
              direction: amount < 0 ? 'down' : 'up',
              reason:
                match.otherProformas.length > 0
                  ? `Según PDF (ya estaba en ${match.otherProformas.join(', ')})`
                  : 'Según PDF (facturado en el sistema anterior)',
            },
          }
        } else {
          lines[tripId] = { amount: formatTripLineAmount(amount), taxes: '0' }
          if (match.kind === 'shared') shared.add(tripId)
        }
      }
      setSelectedTripIds(Array.from(byTrip.keys()))
      setTripLines(lines)
      setSharedTripIds(shared)

      const missing = group.rows.filter((r) => !res.matches[r.code]).length
      toast.success(
        `Se leyeron ${group.rows.length} viajes del PDF` +
          (missing > 0 ? ` · ${missing} no existe${missing === 1 ? '' : 'n'} en la plataforma` : '')
      )
    } finally {
      setPdfReading(false)
    }
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
      if (pdfGroup) {
        formData.set('pdf_total', String(pdfGroup.total))
        formData.set('pdf_proforma', pdfGroup.proformaNumber)
      }
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
                <span className="text-base font-semibold tabular-nums">Neto {formatCurrency(total)}</span>
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
                  disabled={!canGoNext || pending || pdfReading}
                  onClick={() => setStep(2)}
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  type="button"
                  className="flex-1"
                  disabled={pending || pdfReading || selectedTripIds.length === 0 || pdfBlocksSave}
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
                      onClick={removePdf}
                      disabled={pending || pdfReading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center hover:bg-muted/30 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Tocá para subir el PDF recibido</span>
                    <span className="text-xs text-muted-foreground">
                      Si es una proforma de Arcor, se cargan solos los viajes y los importes
                    </span>
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

              {pdfReading && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Leyendo el PDF…
                </p>
              )}

              {pdfGroups.length > 1 && (
                <Field>
                  <FieldLabel>El PDF trae {pdfGroups.length} proformas: ¿cuál cargás?</FieldLabel>
                  <Select
                    value={pdfGroup?.proformaNumber ?? ''}
                    onValueChange={(v) => {
                      const g = pdfGroups.find((x) => x.proformaNumber === v)
                      if (g) void applyPdfGroup(g)
                    }}
                    disabled={pending || pdfReading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegir proforma del PDF" />
                    </SelectTrigger>
                    <SelectContent>
                      {pdfGroups.map((g) => (
                        <SelectItem key={g.proformaNumber} value={g.proformaNumber}>
                          {g.proformaNumber} — {g.companyName} · {g.rows.length} viajes · {formatCurrency(g.total)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {pdfGroup && !pdfReading && (
                <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  Leída del PDF: <span className="font-medium">{pdfGroup.proformaNumber}</span> ·{' '}
                  {pdfGroup.rows.length} viajes · {formatCurrency(pdfGroup.total)}. En el paso siguiente
                  revisás que coincida antes de guardar.
                </p>
              )}

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
            <>
            {pdfGroup && pdfReview && (
              <ProformaPdfCheck
                proformaNumber={pdfGroup.proformaNumber}
                review={pdfReview}
                reviewed={pdfReviewed}
                onReviewedChange={setPdfReviewed}
                disabled={pending}
              />
            )}
            <SelectedTripsEditor
              trips={allTrips}
              selectedTripIds={selectedTripIds}
              tripLines={tripLines}
              sharedTripIds={sharedTripIds}
              onRemoveTrip={toggleTrip}
              onUpdateLine={updateTripLine}
              onAddTrips={() => setAddTripsOpen(true)}
              onAddSharedTrip={() => setAddSharedOpen(true)}
              onAddAdjustment={() => setAddAdjustmentOpen(true)}
              onUpdateAdjustment={updateAdjustment}
              billingHistory={tripBillingHistory}
              disabled={pending}
            />
            </>
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

      <AddSharedTripDialog
        open={addSharedOpen}
        onOpenChange={setAddSharedOpen}
        excludeTripIds={selectedTripIds}
        onConfirm={confirmSharedTrip}
      />

      <AddAdjustmentTripsDialog
        open={addAdjustmentOpen}
        onOpenChange={setAddAdjustmentOpen}
        trips={adjustableTrips}
        excludeTripIds={selectedTripIds}
        history={tripBillingHistory}
        onConfirm={confirmAdjustmentTrips}
      />
    </>
  )
}
