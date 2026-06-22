'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Trip } from '@/lib/types'
import { getTripEstimatedAmount, type TripLineValues } from '@/lib/proformas/trip-estimate-amount'

export type { TripLineValues }
const COMPACT_PAGE_SIZE = 12

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

function formatTripDate(date?: Date) {
  return date ? dateFormatter.format(date) : '—'
}

function tripSortDate(trip: Trip) {
  return trip.departureDate?.getTime() ?? trip.createdAt.getTime()
}

function tripArcorClientName(trip: Trip) {
  return trip.arcorClient?.name ?? trip.client?.name ?? '—'
}

function tripRouteLabel(trip: Trip) {
  if (trip.origin && trip.destination) return `${trip.origin} → ${trip.destination}`
  return trip.origin || trip.destination || '—'
}

function tripMatchesSearch(trip: Trip, query: string) {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    trip.code.toLowerCase().includes(q) ||
    trip.origin.toLowerCase().includes(q) ||
    (trip.destination?.toLowerCase().includes(q) ?? false) ||
    (trip.arcorClient?.name.toLowerCase().includes(q) ?? false) ||
    (trip.arcorClient?.accountId?.toLowerCase().includes(q) ?? false) ||
    (trip.client?.name.toLowerCase().includes(q) ?? false) ||
    (trip.driver?.name.toLowerCase().includes(q) ?? false) ||
    (trip.vehicle?.plate.toLowerCase().includes(q) ?? false)
  )
}

const PAGE_SIZES = [10, 25, 50] as const

type BillableTripsPickerProps = {
  trips: Trip[]
  selectedTripIds: string[]
  tripLines: Record<string, TripLineValues>
  onToggleTrip: (tripId: string) => void
  onUpdateLine: (tripId: string, field: 'amount' | 'taxes', value: string) => void
  onSelectTrips: (tripIds: string[]) => void
  onClearSelection: () => void
  disabled?: boolean
  /** compact: importes inline | picker: solo selección (diálogo auxiliar) */
  variant?: 'default' | 'compact' | 'picker'
}

export function BillableTripsPicker({
  trips,
  selectedTripIds,
  tripLines,
  onToggleTrip,
  onUpdateLine,
  onSelectTrips,
  onClearSelection,
  disabled,
  variant = 'default',
}: BillableTripsPickerProps) {
  const compact = variant === 'compact'
  const pickerOnly = variant === 'picker'
  const [search, setSearch] = useState('')
  const [arcorClientFilter, setArcorClientFilter] = useState<string>('all')
  const [pageSize, setPageSize] = useState<number>(
    pickerOnly ? 15 : compact ? COMPACT_PAGE_SIZE : 10
  )
  const [page, setPage] = useState(1)

  const arcorClientOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const trip of trips) {
      const client = trip.arcorClient ?? trip.client
      if (client) byId.set(client.id, client.name)
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [trips])

  const filteredTrips = useMemo(() => {
    return trips
      .filter((trip) => {
        const matchClient =
          arcorClientFilter === 'all' ||
          trip.arcorClientId === arcorClientFilter ||
          trip.clientId === arcorClientFilter
        return matchClient && tripMatchesSearch(trip, search)
      })
      .sort((a, b) => tripSortDate(b) - tripSortDate(a))
  }, [trips, search, arcorClientFilter])

  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageTrips = filteredTrips.slice(pageStart, pageStart + pageSize)

  const selectedTrips = useMemo(
    () =>
      selectedTripIds
        .map((id) => trips.find((t) => t.id === id))
        .filter((t): t is Trip => !!t)
        .sort((a, b) => tripSortDate(b) - tripSortDate(a)),
    [selectedTripIds, trips]
  )

  const pageTripIds = pageTrips.map((t) => t.id)
  const allPageSelected =
    pageTripIds.length > 0 && pageTripIds.every((id) => selectedTripIds.includes(id))

  const selectPage = () => {
    const merged = new Set([...selectedTripIds, ...pageTripIds])
    onSelectTrips([...merged])
  }

  const deselectPage = () => {
    onSelectTrips(selectedTripIds.filter((id) => !pageTripIds.includes(id)))
  }

  const selectFiltered = () => {
    const merged = new Set([...selectedTripIds, ...filteredTrips.map((t) => t.id)])
    onSelectTrips([...merged])
  }

  const applySearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const applyArcorFilter = (value: string) => {
    setArcorClientFilter(value)
    setPage(1)
  }

  if (trips.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4 text-center">
        No hay viajes en pendiente de pago disponibles.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={compact || pickerOnly ? 'Buscar viaje…' : 'Buscar por código, cliente, ruta, chofer o patente...'}
            value={search}
            onChange={(e) => applySearch(e.target.value)}
            className="pl-9 h-9"
            disabled={disabled}
          />
        </div>
        {arcorClientOptions.length > 1 && (
          <Select value={arcorClientFilter} onValueChange={applyArcorFilter} disabled={disabled}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {arcorClientOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {filteredTrips.length === 0
            ? 'Sin resultados'
            : `${filteredTrips.length} disponible${filteredTrips.length === 1 ? '' : 's'}`}
          {selectedTripIds.length > 0 && ` · ${selectedTripIds.length} incluido${selectedTripIds.length === 1 ? '' : 's'}`}
        </span>
        <div className="flex flex-wrap gap-2">
          {!compact && !pickerOnly && filteredTrips.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={allPageSelected ? deselectPage : selectPage}
              disabled={disabled}
            >
              {allPageSelected ? 'Quitar página' : 'Seleccionar página'}
            </Button>
          )}
          {!compact && !pickerOnly && filteredTrips.length > pageSize && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={selectFiltered}
              disabled={disabled}
            >
              Seleccionar filtrados ({filteredTrips.length})
            </Button>
          )}
          {selectedTripIds.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={onClearSelection}
              disabled={disabled}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {filteredTrips.length > 0 && (
        <>
          <div className="rounded-md border overflow-hidden">
            {!compact && (
              <div className="hidden sm:grid sm:grid-cols-[auto_1fr] sm:gap-x-3 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                <span className="w-8" />
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-2">
                  <span>Código / fecha</span>
                  <span>Cliente · ruta</span>
                  <span>Chofer · unidad</span>
                </div>
              </div>
            )}
            <div className={(compact || pickerOnly) ? 'max-h-72 overflow-y-auto divide-y' : 'max-h-52 overflow-y-auto divide-y'}>
              {pageTrips.map((trip) => {
                const selected = selectedTripIds.includes(trip.id)
                return (
                  <div
                    key={trip.id}
                    className={selected && (compact || pickerOnly) ? 'bg-primary/5' : undefined}
                  >
                    <label
                      className={
                        compact || pickerOnly
                          ? 'flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/40'
                          : 'flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 sm:items-center'
                      }
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggleTrip(trip.id)}
                        disabled={disabled}
                        className="mt-1 shrink-0"
                      />
                      {compact || pickerOnly ? (
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                            <span className="font-mono text-sm font-medium">{trip.code}</span>
                            <span className="text-xs text-muted-foreground">{formatTripDate(trip.departureDate)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {tripArcorClientName(trip)} · {tripRouteLabel(trip)}
                          </p>
                          {pickerOnly && (() => {
                            const est = getTripEstimatedAmount(trip)
                            return est != null ? (
                              <p className="text-xs text-muted-foreground tabular-nums">
                                Estimado: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(est)}
                              </p>
                            ) : null
                          })()}
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1 grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] sm:gap-2 sm:items-center">
                          <div>
                            <div className="font-mono text-sm font-medium">{trip.code}</div>
                            <div className="text-xs text-muted-foreground">{formatTripDate(trip.departureDate)}</div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm truncate">{tripArcorClientName(trip)}</div>
                            <div className="text-xs text-muted-foreground truncate">{tripRouteLabel(trip)}</div>
                          </div>
                          <div className="min-w-0 text-xs text-muted-foreground">
                            <div className="truncate">{trip.driver?.name ?? '—'}</div>
                            <div className="truncate">{trip.vehicle?.plate ?? '—'}</div>
                          </div>
                        </div>
                      )}
                    </label>
                    {compact && !pickerOnly && selected && (
                      <div className="grid grid-cols-2 gap-2 px-3 pb-2.5 pl-10">
                        <Field>
                          <FieldLabel className="text-xs">Importe *</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            required
                            placeholder="0"
                            value={tripLines[trip.id]?.amount ?? ''}
                            onChange={(e) => onUpdateLine(trip.id, 'amount', e.target.value)}
                            disabled={disabled}
                            className="h-8"
                          />
                        </Field>
                        <Field>
                          <FieldLabel className="text-xs">IVA</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={tripLines[trip.id]?.taxes ?? '0'}
                            onChange={(e) => onUpdateLine(trip.id, 'taxes', e.target.value)}
                            disabled={disabled}
                            className="h-8"
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {pageStart + 1}–{Math.min(pageStart + pageSize, filteredTrips.length)} de {filteredTrips.length}
              </span>
              <div className="flex items-center gap-1">
                {!compact && !pickerOnly && (
                  <>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v))
                        setPage(1)
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-7 w-[70px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((size) => (
                          <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="mr-1">/ pág</span>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={safePage <= 1 || disabled}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="tabular-nums px-1">{safePage}/{totalPages}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={safePage >= totalPages || disabled}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {!compact && !pickerOnly && selectedTrips.length > 0 && (
        <div className="rounded-md border bg-muted/20">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">
              Seleccionados ({selectedTrips.length})
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onClearSelection}
              disabled={disabled}
            >
              Quitar todos
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y">
            {selectedTrips.map((trip) => (
              <div key={trip.id} className="px-3 py-2.5 space-y-2">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-medium">{trip.code}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {formatTripDate(trip.departureDate)} · {tripArcorClientName(trip)} · {tripRouteLabel(trip)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel className="text-xs">Importe</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      placeholder="0"
                      value={tripLines[trip.id]?.amount ?? ''}
                      onChange={(e) => onUpdateLine(trip.id, 'amount', e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="text-xs">IVA</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={tripLines[trip.id]?.taxes ?? '0'}
                      onChange={(e) => onUpdateLine(trip.id, 'taxes', e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
