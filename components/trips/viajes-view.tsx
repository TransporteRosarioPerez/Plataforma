'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, Route, FileText, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TripStatusBadge } from '@/components/trip-status-badge'
import { TripEconomicsSummary } from '@/components/trips/trip-economics-summary'
import { TripFiltersPanel } from '@/components/trips/trip-filters-panel'
import { TripSortableHead } from '@/components/trips/trip-sortable-head'
import { tripStatusLabels } from '@/lib/types'
import type { Trip, TripStatus, ArcorClient, Vehicle, Driver } from '@/lib/types'
import { getTripMasterPrerequisites } from '@/lib/trip-prerequisites'
import {
  buildTripListSearchParams,
  DEFAULT_TRIP_LIST_FILTERS,
  filterTrips,
  getTripDateRangeLabel,
  parseTripListFilters,
  patchTripDatePeriod,
  sortTrips,
  toggleTripSort,
  type TripDatePeriod,
  type TripListFilters,
  type TripSortColumn,
} from '@/lib/trips/list-filters'
import { NewTripSheet } from '@/components/trips/new-trip-sheet'

const PAGE_SIZES = [25, 50, 100] as const

const DATE_QUICK_FILTERS: { id: TripDatePeriod; label: string }[] = [
  { id: 'all', label: 'Todas las fechas' },
  { id: 'current_month', label: 'Este mes' },
  { id: 'previous_month', label: 'Mes anterior' },
  { id: 'last_3_months', label: 'Últimos 3 meses' },
]

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

function formatTripDate(date?: Date) {
  return date ? dateFormatter.format(date) : '—'
}

function formatRouteLine(trip: Trip) {
  const destination = trip.destination?.trim()
  const origin = trip.origin?.trim() ?? ''
  if (destination && destination !== origin) {
    return `${origin} → ${destination}`
  }
  return origin || destination || '—'
}

function formatTripMeta(trip: Trip) {
  return [
    trip.driver?.name?.split(' ').slice(0, 2).join(' '),
    trip.vehicle?.plate,
  ].filter(Boolean).join(' · ')
}

type ViajesViewProps = {
  trips: Trip[]
  arcorClients: ArcorClient[]
  vehicles: Vehicle[]
  drivers: Driver[]
}

export function ViajesView({ trips, arcorClients, vehicles, drivers }: ViajesViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filtersFromUrl = useMemo(() => parseTripListFilters(searchParams), [searchParams])

  const [filters, setFilters] = useState<TripListFilters>(filtersFromUrl)
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const parsed = parseTripListFilters(searchParams)
    return (
      parsed.clientId !== 'all' ||
      parsed.driverId !== 'all' ||
      parsed.vehicleId !== 'all' ||
      parsed.tripType !== 'all' ||
      parsed.cargoType !== 'all' ||
      parsed.datePeriod !== 'all' ||
      parsed.pdf !== 'all'
    )
  })
  const [pageSize, setPageSize] = useState<number>(50)
  const [page, setPage] = useState(1)
  const [showNewTrip, setShowNewTrip] = useState(false)

  useEffect(() => {
    setFilters(filtersFromUrl)
  }, [filtersFromUrl])

  const prerequisites = getTripMasterPrerequisites(arcorClients, vehicles, drivers)

  const syncFilters = (next: TripListFilters) => {
    setFilters(next)
    setPage(1)
    const qs = buildTripListSearchParams(next).toString()
    router.replace(qs ? `/app/viajes?${qs}` : '/app/viajes', { scroll: false })
  }

  const patchFilters = (patch: Partial<TripListFilters>) => {
    syncFilters({ ...filters, ...patch })
  }

  const applyStatusFilter = (value: TripStatus | 'all') => {
    patchFilters({ status: value })
  }

  const applyDatePeriod = (period: TripDatePeriod) => {
    patchFilters(patchTripDatePeriod(period))
  }

  const applySort = (column: TripSortColumn) => {
    patchFilters(toggleTripSort(filters, column))
  }

  const clearCustomFilters = () => {
    patchFilters({
      clientId: 'all',
      driverId: 'all',
      vehicleId: 'all',
      tripType: 'all',
      cargoType: 'all',
      datePeriod: 'all',
      dateFrom: '',
      dateTo: '',
      pdf: 'all',
    })
  }

  const dateRangeLabel = getTripDateRangeLabel(filters)

  const filtered = useMemo(
    () => sortTrips(filterTrips(trips, filters), filters.sort, filters.sortDir),
    [trips, filters]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageTrips = filtered.slice(pageStart, pageStart + pageSize)

  const newTripButton = (
    <Button onClick={() => setShowNewTrip(true)} disabled={!prerequisites.canCreate}>
      <Plus className="mr-2 h-4 w-4" />Nuevo viaje
    </Button>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Viajes</h1>
          <p className="text-muted-foreground">{trips.length} viajes registrados</p>
        </div>
        {prerequisites.canCreate ? (
          newTripButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>{newTripButton}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium mb-1">Completá los maestros primero:</p>
              <ul className="list-disc pl-4">
                {prerequisites.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Listado</CardTitle>
                <CardDescription>
                  {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                  {filtered.length !== trips.length && ` de ${trips.length}`}
                  {dateRangeLabel && (
                    <span className="block sm:inline sm:before:content-['·_'] sm:before:mx-1">
                      Salida: {dateRangeLabel}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar carga, cliente, ruta..."
                    value={filters.search}
                    onChange={(e) => patchFilters({ search: e.target.value })}
                    className="pl-9"
                  />
                </div>
                <select
                  value={filters.status}
                  onChange={(e) => applyStatusFilter(e.target.value as TripStatus | 'all')}
                  className="h-9 rounded-md border px-3 text-sm"
                >
                  <option value="all">Todos los estados</option>
                  {Object.entries(tripStatusLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {DATE_QUICK_FILTERS.map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  variant={filters.datePeriod === id ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => applyDatePeriod(id)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <TripFiltersPanel
              filters={filters}
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              onChange={patchFilters}
              onClearCustom={clearCustomFilters}
              clients={arcorClients}
              drivers={drivers}
              vehicles={vehicles}
            />
          </div>
        </CardHeader>

        <CardContent className="min-w-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Route className="h-12 w-12 mb-4 opacity-50" />
              <p>No hay viajes que coincidan con los filtros.</p>
              <Button
                type="button"
                variant="link"
                className="mt-2"
                onClick={() => syncFilters({ ...DEFAULT_TRIP_LIST_FILTERS })}
              >
                Restablecer todos los filtros
              </Button>
            </div>
          ) : (
            <>
              <div className="[&_[data-slot=table-container]]:overflow-x-hidden">
              <Table className="table-fixed">
                <colgroup>
                  <col className="w-[9%]" />
                  <col className="w-[18%]" />
                  <col className="w-[28%]" />
                  <col className="w-[13%]" />
                  <col className="w-[24%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TripSortableHead
                      label="Carga"
                      column="code"
                      activeColumn={filters.sort}
                      activeDirection={filters.sortDir}
                      onSort={applySort}
                    />
                    <TripSortableHead
                      label="Cliente"
                      column="client"
                      activeColumn={filters.sort}
                      activeDirection={filters.sortDir}
                      onSort={applySort}
                    />
                    <TripSortableHead
                      label="Viaje"
                      column="route"
                      activeColumn={filters.sort}
                      activeDirection={filters.sortDir}
                      onSort={applySort}
                    />
                    <TripSortableHead
                      label="Fechas"
                      column="departure"
                      activeColumn={filters.sort}
                      activeDirection={filters.sortDir}
                      onSort={applySort}
                    />
                    <TripSortableHead
                      label="Estado"
                      column="status"
                      activeColumn={filters.sort}
                      activeDirection={filters.sortDir}
                      onSort={applySort}
                    />
                    <TripSortableHead
                      label="PDF"
                      column="pdf"
                      activeColumn={filters.sort}
                      activeDirection={filters.sortDir}
                      onSort={applySort}
                      className="text-center"
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageTrips.map((trip) => {
                    const routeLine = formatRouteLine(trip)
                    const metaLine = formatTripMeta(trip)

                    return (
                    <TableRow
                      key={trip.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/app/viajes/${trip.id}`)}
                    >
                      <TableCell className="max-w-0 whitespace-normal px-2 py-2 align-top">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <span className="font-mono text-xs font-medium leading-tight truncate" title={trip.code}>
                            {trip.code}
                          </span>
                          {(trip.observationCount ?? 0) > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                  <MessageSquare className="h-3 w-3" aria-hidden />
                                  {trip.observationCount}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {trip.observationCount} observación{(trip.observationCount ?? 0) !== 1 ? 'es' : ''}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-0 whitespace-normal px-2 py-2 align-top">
                        <div className="truncate text-sm font-medium" title={trip.client?.name}>
                          {trip.client?.name ?? '—'}
                        </div>
                        {trip.client?.accountId && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            Cta. {trip.client.accountId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-0 whitespace-normal px-2 py-2 align-top">
                        <div className="truncate text-sm" title={routeLine}>
                          {routeLine}
                        </div>
                        {metaLine && (
                          <div className="truncate text-[11px] text-muted-foreground" title={metaLine}>
                            {metaLine}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-0 whitespace-normal px-2 py-2 align-top">
                        <div className="space-y-0.5 text-[11px] leading-tight">
                          <div>
                            <span className="text-muted-foreground">Carga </span>
                            <span className="tabular-nums">{formatTripDate(trip.departureDate)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Entrega </span>
                            <span className="tabular-nums">{formatTripDate(trip.arrivalDate)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-0 whitespace-normal px-2 py-2 align-top">
                        <div className="flex flex-col items-start gap-1 min-w-0">
                          <TripStatusBadge status={trip.status} size="sm" compact />
                          <TripEconomicsSummary
                            income={trip.totalIncome}
                            expenses={trip.totalExpenses}
                            variant="table-inline"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal px-2 py-2 align-top text-center">
                        {trip.pdfStorageKey ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                            <FileText className="h-3.5 w-3.5" aria-hidden />
                            Sí
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Mostrando {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} de {filtered.length}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                    className="h-9 rounded-md border px-3 text-sm"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>{size} por página</option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm tabular-nums min-w-[80px] text-center">
                    {safePage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <NewTripSheet
        open={showNewTrip}
        onOpenChange={setShowNewTrip}
        arcorClients={arcorClients}
        vehicles={vehicles}
        drivers={drivers}
      />
    </div>
  )
}
