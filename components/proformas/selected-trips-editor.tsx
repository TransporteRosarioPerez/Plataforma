'use client'

import { ArrowDown, ArrowUp, Plus, Share2, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Field, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import type { Trip } from '@/lib/types'
import {
  amountsMatch,
  formatTripLineAmount,
  getTripEstimatedAmount,
  parseTripLineAmount,
  signedTripLineAmount,
  type TripBillingHistoryEntry,
  type TripLineAdjustment,
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
  sharedTripIds?: Set<string>
  onRemoveTrip: (tripId: string) => void
  onUpdateLine: (tripId: string, value: string) => void
  onAddTrips: () => void
  onAddSharedTrip?: () => void
  /** Abre el diálogo de “Ajuste de viaje” (viajes ya facturados/cobrados). */
  onAddAdjustment?: () => void
  onUpdateAdjustment?: (tripId: string, patch: Partial<TripLineAdjustment>) => void
  /** Líneas del viaje en otras proformas, para mostrar lo ya facturado. */
  billingHistory?: Record<string, TripBillingHistoryEntry[]>
  disabled?: boolean
}

const proformaStatusShort: Record<TripBillingHistoryEntry['proformaStatus'], string> = {
  pendiente: 'pendiente',
  facturada: 'facturada',
  cobrada: 'cobrada',
}

function AdjustmentLine({
  trip,
  line,
  history,
  onRemove,
  onUpdateLine,
  onUpdateAdjustment,
  disabled,
}: {
  trip: Trip
  line: TripLineValues
  history: TripBillingHistoryEntry[]
  onRemove: () => void
  onUpdateLine: (value: string) => void
  onUpdateAdjustment?: (patch: Partial<TripLineAdjustment>) => void
  disabled?: boolean
}) {
  const adjustment = line.adjustment ?? { direction: 'up' as const, reason: '' }
  const alreadyBilled = history.reduce((sum, entry) => sum + entry.amount, 0)
  const delta = signedTripLineAmount(line)
  const hasDelta = parseTripLineAmount(line.amount) > 0

  return (
    <div className="p-3 space-y-2.5 bg-amber-500/5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold">{trip.code}</span>
            <span className="text-xs text-muted-foreground">
              {trip.departureDate ? dateFormatter.format(trip.departureDate) : '—'}
            </span>
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-800 bg-amber-500/10">
              Ajuste
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{tripRouteLabel(trip)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Quitar ajuste de ${trip.code}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {history.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {history.map((entry) => (
            <li key={entry.proformaId} className="flex justify-between gap-2">
              <span className="truncate">
                {entry.isLegacy ? (
                  <>Original · sistema anterior ({proformaStatusShort[entry.proformaStatus]})</>
                ) : (
                  <>
                    {entry.isAdjustment ? 'Ajuste' : 'Original'} ·{' '}
                    <span className="font-mono">{entry.proformaNumber}</span> (
                    {proformaStatusShort[entry.proformaStatus]})
                  </>
                )}
              </span>
              <span className="tabular-nums shrink-0">{formatCurrency(entry.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-2 items-end">
        <Field>
          <FieldLabel className="text-xs">Tipo</FieldLabel>
          <div className="flex h-9 rounded-md border p-0.5" role="group" aria-label="Tipo de ajuste">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onUpdateAdjustment?.({ direction: 'up' })}
              className={cn(
                'flex items-center gap-1 rounded px-2.5 text-xs font-medium transition-colors',
                adjustment.direction === 'up'
                  ? 'bg-green-600 text-white'
                  : 'text-muted-foreground hover:bg-muted'
              )}
              aria-pressed={adjustment.direction === 'up'}
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Suma
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onUpdateAdjustment?.({ direction: 'down' })}
              className={cn(
                'flex items-center gap-1 rounded px-2.5 text-xs font-medium transition-colors',
                adjustment.direction === 'down'
                  ? 'bg-red-600 text-white'
                  : 'text-muted-foreground hover:bg-muted'
              )}
              aria-pressed={adjustment.direction === 'down'}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Resta
            </button>
          </div>
        </Field>
        <Field>
          <FieldLabel className="text-xs">Diferencia neta *</FieldLabel>
          <NumberInput
            min={0}
            decimals={2}
            required
            placeholder="0"
            value={line.amount}
            onValueChange={(v) => onUpdateLine(formatTripLineAmount(v))}
            disabled={disabled}
            className="h-9"
          />
        </Field>
      </div>

      <Field>
        <FieldLabel className="text-xs">Motivo</FieldLabel>
        <Input
          value={adjustment.reason}
          onChange={(e) => onUpdateAdjustment?.({ reason: e.target.value })}
          placeholder="Ej. actualización de tarifa septiembre"
          disabled={disabled}
          className="h-9"
          maxLength={200}
        />
      </Field>

      {hasDelta && (
        <p className="text-xs">
          Ingreso del viaje: {formatCurrency(alreadyBilled)}{' '}
          <span className={delta >= 0 ? 'text-green-700' : 'text-red-700'}>
            {delta >= 0 ? '+' : '−'} {formatCurrency(Math.abs(delta))}
          </span>{' '}
          = <span className="font-semibold">{formatCurrency(alreadyBilled + delta)}</span>
        </p>
      )}
    </div>
  )
}

export function SelectedTripsEditor({
  trips,
  selectedTripIds,
  tripLines,
  sharedTripIds,
  onRemoveTrip,
  onUpdateLine,
  onAddTrips,
  onAddSharedTrip,
  onAddAdjustment,
  onUpdateAdjustment,
  billingHistory,
  disabled,
}: SelectedTripsEditorProps) {
  const selectedTrips = selectedTripIds
    .map((id) => trips.find((t) => t.id === id))
    .filter((t): t is Trip => !!t)

  const hasAnyEstimate = selectedTrips.some(
    (t) => !tripLines[t.id]?.adjustment && getTripEstimatedAmount(t) != null
  )

  if (selectedTrips.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Agregá los viajes que querés incluir en esta proforma.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onAddTrips} disabled={disabled}>
            <Plus className="mr-2 h-4 w-4" />
            Elegir viajes
          </Button>
          {onAddAdjustment && (
            <Button type="button" variant="outline" size="sm" onClick={onAddAdjustment} disabled={disabled}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Ajuste de viaje
            </Button>
          )}
          {onAddSharedTrip && (
            <Button type="button" variant="ghost" size="sm" onClick={onAddSharedTrip} disabled={disabled}>
              <Share2 className="mr-2 h-4 w-4" />
              Viaje compartido
            </Button>
          )}
        </div>
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
          const line = tripLines[trip.id]
          if (line?.adjustment) {
            return (
              <AdjustmentLine
                key={trip.id}
                trip={trip}
                line={line}
                history={billingHistory?.[trip.id] ?? []}
                onRemove={() => onRemoveTrip(trip.id)}
                onUpdateLine={(value) => onUpdateLine(trip.id, value)}
                onUpdateAdjustment={
                  onUpdateAdjustment ? (patch) => onUpdateAdjustment(trip.id, patch) : undefined
                }
                disabled={disabled}
              />
            )
          }
          const estimate = getTripEstimatedAmount(trip)
          const amountRaw = tripLines[trip.id]?.amount ?? ''
          const amountNum = parseTripLineAmount(amountRaw)
          const hasAmount = amountRaw !== '' && amountNum > 0
          const matchesEstimate =
            estimate != null && hasAmount ? amountsMatch(amountNum, estimate) : null

          return (
            <div key={trip.id} className="p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{trip.code}</span>
                    <span className="text-xs text-muted-foreground">
                      {trip.departureDate ? dateFormatter.format(trip.departureDate) : '—'}
                    </span>
                    {sharedTripIds?.has(trip.id) && (
                      <Badge variant="outline" className="text-[10px]">
                        Compartido
                      </Badge>
                    )}
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
                  <NumberInput
                    min={0}
                    decimals={2}
                    required
                    placeholder="0"
                    value={tripLines[trip.id]?.amount ?? ''}
                    onValueChange={(v) => onUpdateLine(trip.id, formatTripLineAmount(v))}
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
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onAddTrips} disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar más viajes
        </Button>
        {onAddAdjustment && (
          <Button type="button" variant="outline" size="sm" onClick={onAddAdjustment} disabled={disabled}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Ajuste de viaje
          </Button>
        )}
        {onAddSharedTrip && (
          <Button type="button" variant="ghost" size="sm" onClick={onAddSharedTrip} disabled={disabled}>
            <Share2 className="mr-2 h-4 w-4" />
            Viaje compartido
          </Button>
        )}
      </div>
    </div>
  )
}
