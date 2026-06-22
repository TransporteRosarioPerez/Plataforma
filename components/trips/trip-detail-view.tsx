'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  tripStatusLabels, tripStatusColors, cargoTypeLabels, tripTypeLabels, OPERATIONAL_TRIP_STATUSES,
} from '@/lib/types'
import type { Trip, TripDocument, TripObservation, Proforma, Invoice, TripExpense, ExpenseCategory } from '@/lib/types'
import { updateTripStatus, deleteTrip } from '@/lib/actions/trips'
import { TripBillingSection } from '@/components/trips/trip-billing-section'
import { TripExpensesSection } from '@/components/trips/trip-expenses-section'
import { TripObservationsSection } from '@/components/trips/trip-observations-section'
import { TripEconomicsSummary } from '@/components/trips/trip-economics-summary'
import { TripEstimateSection } from '@/components/trips/trip-estimate-section'
import { DownloadPdfButton } from '@/components/trips/download-pdf-button'
import { UploadPdfDialog } from '@/components/trips/upload-pdf-dialog'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type TripDetailViewProps = {
  trip: Trip
  documents: TripDocument[]
  observations: TripObservation[]
  proformas: Proforma[]
  invoices: Invoice[]
  expenses: TripExpense[]
  expenseCategories: ExpenseCategory[]
}

export function TripDetailView({
  trip,
  documents,
  observations,
  proformas,
  invoices,
  expenses,
  expenseCategories,
}: TripDetailViewProps) {
  const router = useRouter()
  const [status, setStatus] = useState(trip.status)
  const [showUpload, setShowUpload] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  const tripPdf = documents.find((d) => d.documentType === 'trip_pdf')
  const pdfKey = trip.pdfStorageKey ?? tripPdf?.storagePath ?? tripPdf?.fileUrl
  const pdfFileName = tripPdf?.fileName ?? (pdfKey ? pdfKey.split('/').pop() : undefined)

  const isBillingLocked = trip.status === 'pending_payment' || trip.status === 'paid'

  const handleStatusSave = async () => {
    if (status === trip.status) return
    setSavingStatus(true)
    const result = await updateTripStatus(trip.id, status)
    setSavingStatus(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success('Estado actualizado')
      router.refresh()
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Dar de baja este viaje? Podés recuperarlo desde Papelera.')) return
    const result = await deleteTrip(trip.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success('Viaje eliminado')
      router.push('/app/viajes')
    }
  }

  const formatDate = (d?: Date) =>
    d ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(d) : '—'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/viajes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-bold font-mono">{trip.code}</h1>
          <Badge variant="outline" className={tripStatusColors[trip.status]}>
            {tripStatusLabels[trip.status] ?? trip.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isBillingLocked ? (
            <span className="text-xs text-muted-foreground max-w-xs text-right">
              {trip.status === 'paid'
                ? 'El cobro se registra al marcar la proforma como Cobrada.'
                : 'En cobranza — gestioná el cobro desde Proformas.'}
            </span>
          ) : (
            <>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="h-9 rounded-md border px-3 text-sm"
              >
                {OPERATIONAL_TRIP_STATUSES.map((s) => (
                  <option key={s} value={s}>{tripStatusLabels[s]}</option>
                ))}
              </select>
              <Button variant="outline" onClick={handleStatusSave} disabled={savingStatus || status === trip.status}>
                Guardar estado
              </Button>
            </>
          )}
        </div>
        <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
      </div>

      <TripEconomicsSummary
        income={trip.totalIncome}
        expenses={trip.totalExpenses}
      />

      <Tabs defaultValue="operacion">
        <TabsList>
          <TabsTrigger value="operacion">Operación</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="facturacion">Cobranza</TabsTrigger>
        </TabsList>

        <TabsContent value="operacion" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>General</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Cliente:</span> {trip.client?.name ?? '—'}</p>
                {trip.client?.accountId && (
                  <p><span className="text-muted-foreground">Cuenta:</span> {trip.client.accountId}</p>
                )}
                <p><span className="text-muted-foreground">Origen:</span> {trip.origin}</p>
                <p><span className="text-muted-foreground">Destino:</span> {trip.destination ?? '—'}</p>
                <p><span className="text-muted-foreground">Cant. clientes:</span> {trip.numberOfClients ?? '—'}</p>
                <p><span className="text-muted-foreground">Tipo:</span> {tripTypeLabels[trip.tripType]}</p>
                <p><span className="text-muted-foreground">Carga:</span> {cargoTypeLabels[trip.cargoType]}</p>
                <p><span className="text-muted-foreground">Carga origen:</span> {formatDate(trip.departureDate)}</p>
                <p><span className="text-muted-foreground">Entrega estimada:</span> {formatDate(trip.arrivalDate)}</p>
                {(trip.totalPallets || trip.totalPackages) && (
                  <p>
                    <span className="text-muted-foreground">Pallets / Bultos:</span>{' '}
                    {trip.totalPallets ?? '—'} / {trip.totalPackages ?? '—'}
                  </p>
                )}
                {isBillingLocked && <TripEstimateSection trip={trip} readOnly />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Asignaciones y km</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Chofer:</span> {trip.driver?.name ?? '—'}</p>
                <p><span className="text-muted-foreground">Camión:</span> {trip.vehicle ? `${trip.vehicle.plate} (${trip.vehicle.brand})` : '—'}</p>
                <p><span className="text-muted-foreground">Semi / Acoplado:</span> {trip.trailer?.plate ?? '—'}</p>
                <p><span className="text-muted-foreground">Km Arcor:</span> {trip.kmArcorSystem ?? '—'}</p>
                <p><span className="text-muted-foreground">Km chofer:</span> {trip.kmRealDriver ?? '—'}</p>
                <p><span className="text-muted-foreground">Km satélite:</span> {trip.kmSatelliteGoogle ?? '—'}</p>
              </CardContent>
            </Card>

            {!isBillingLocked && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle>Precio estimado</CardTitle></CardHeader>
                <CardContent>
                  <TripEstimateSection trip={trip} />
                </CardContent>
              </Card>
            )}

            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PDF del viaje
                </CardTitle>
                <div className="flex gap-2">
                  {pdfKey && <DownloadPdfButton tripId={trip.id} fileName={pdfFileName} />}
                  <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
                    {pdfKey ? 'Reemplazar PDF' : 'Subir PDF'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pdfKey ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Archivo:</span> {pdfFileName ?? pdfKey}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin PDF asociado a este viaje.</p>
                )}
              </CardContent>
            </Card>

            <TripObservationsSection trip={trip} observations={observations} />
          </div>
        </TabsContent>

        <TabsContent value="gastos" className="mt-4">
          <TripExpensesSection
            trip={trip}
            expenses={expenses}
            categories={expenseCategories}
          />
        </TabsContent>

        <TabsContent value="facturacion" className="mt-4">
          <TripBillingSection trip={trip} proformas={proformas} invoices={invoices} />
        </TabsContent>
      </Tabs>

      <UploadPdfDialog tripId={trip.id} open={showUpload} onOpenChange={setShowUpload} />
    </div>
  )
}
