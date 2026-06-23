'use client'

import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import type { Trip } from '@/lib/types'
import {
  amountsMatch,
  getTripEstimatedAmount,
  type TripLineValues,
} from '@/lib/proformas/trip-estimate-amount'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)

function tripRouteLabel(trip: Trip) {
  if (trip.origin && trip.destination) return `${trip.origin} → ${trip.destination}`
  return trip.origin || trip.destination || '—'
}

type SelectedTripsEditorProps = {
  trips: Trip[]
  selectedTripIds: string[]
  tripLines: Record<string, TripLineValues>
  onRemoveTrip: (tripId: string) => void
  onUpdateLine: (tripId: string, value: string) => void
  onAddTrips: () => void
  disabled?: boolean
}

export function SelectedTripsEditor({
  trips,
  selectedTripIds,
  tripLines,
  onRemoveTrip,
  onUpdateLine,
  onAddTrips,
  disabled,
}: SelectedTripsEditorProps) {
  const selectedTrips = selectedTripIds
    .map((id) => trips.find((t) => t.id === id))
    .filter((t): t is Trip => !!t)

  const hasAnyEstimate = selectedTrips.some((t) => getTripEstimatedAmount(t) != null)

  if (selectedTrips.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Agregá los viajes que querés incluir en esta proforma.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onAddTrips} disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          Elegir viajes
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {hasAnyEstimate && (
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/20 px-3 py-2">
          Los importes sugeridos vienen del precio por pallet cargado en el viaje. Confirmá que
          coincidan con la proforma física antes de guardar.
        </p>
      )}
      <div className="rounded-lg border divide-y overflow-hidden">
        {selectedTrips.map((trip) => {
          const estimate = getTripEstimatedAmount(trip)
          const amountNum = Number(tripLines[trip.id]?.amount)
          const hasAmount = tripLines[trip.id]?.amount !== '' && !Number.isNaN(amountNum)
          const matchesEstimate =
            estimate != null && hasAmount ? amountsMatch(amountNum, estimate) : null

          return (
            <div key={trip.id} className="p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm font-semibold">{trip.code}</span>
                    <span className="text-xs text-muted-foreground">
                      {trip.departureDate ? dateFormatter.format(trip.departureDate) : '—'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {tripRouteLabel(trip)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onRemoveTrip(trip.id)}
                  disabled={disabled}
                  aria-label={`Quitar ${trip.code}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Field>
                  <FieldLabel className="text-xs">Importe neto *</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    placeholder="0"
                    value={tripLines[trip.id]?.amount ?? ''}
                    onChange={(e) => onUpdateLine(trip.id, e.target.value)}
                    disabled={disabled}
                    className="h-9"
                  />
                </Field>
              </div>
              {estimate != null && trip.unitPrice != null && trip.totalPallets != null && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Sugerido del viaje: {formatCurrency(trip.unitPrice)}/pallet ×{' '}
                    {trip.totalPallets} pallets = {formatCurrency(estimate)}
                  </p>
                  {hasAmount && matchesEstimate === true && (
                    <p className="text-xs text-green-700">Coincide con estimado del viaje</p>
                  )}
                  {hasAmount && matchesEstimate === false && (
                    <p className="text-xs text-amber-800">
                      El importe difiere del estimado. Verificá contra la proforma recibida.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAddTrips} disabled={disabled}>
        <Plus className="mr-2 h-4 w-4" />
        Agregar más viajes
      </Button>
    </div>
  )
}
