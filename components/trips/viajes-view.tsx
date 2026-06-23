'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, Route, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TripStatusBadge } from '@/components/trip-status-badge'
import { TripEconomicsSummary } from '@/components/trips/trip-economics-summary'
import { TripFiltersPanel } from '@/components/trips/trip-filters-panel'
import { tripStatusLabels } from '@/lib/types'
import type { Trip, TripStatus, ArcorClient, Vehicle, Driver } from '@/lib/types'
import { getTripMasterPrerequisites } from '@/lib/trip-prerequisites'
import {
  buildTripListSearchParams,
  DEFAULT_TRIP_LIST_FILTERS,
  filterTrips,
  parseTripListFilters,
  tripSortDate,
  type TripListFilters,
  type TripQuickFilter,
} from '@/lib/trips/list-filters'
import { NewTripSheet } from '@/components/trips/new-trip-sheet'

const PAGE_SIZES = [25, 50, 100] as const

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

function formatTripDate(date?: Date) {
  return date ? dateFormatter.format(date) : '—'
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
      !!parsed.dateFrom ||
      !!parsed.dateTo ||
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

  const applyQuickFilter = (next: TripQuickFilter) => {
    const patch: Partial<TripListFilters> = { quick: next }
    if (next === 'pending_payment') patch.status = 'pending_payment'
    else if (next === 'paid') patch.status = 'paid'
    else if (next === 'with_pdf') {
      patch.pdf = 'yes'
    } else if (next === 'all') {
      patch.status = 'all'
      patch.pdf = 'all'
    }
    patchFilters(patch)
  }

  const applyStatusFilter = (value: TripStatus | 'all') => {
    const patch: Partial<TripListFilters> = { status: value }
    if (value !== 'pending_payment' && value !== 'paid') {
      if (filters.quick === 'pending_payment' || filters.quick === 'paid') {
        patch.quick = 'all'
      }
    }
    patchFilters(patch)
  }

  const clearCustomFilters = () => {
    patchFilters({
      clientId: 'all',
      driverId: 'all',
      vehicleId: 'all',
      tripType: 'all',
      cargoType: 'all',
      dateFrom: '',
      dateTo: '',
      pdf: 'all',
      quick: filters.quick === 'with_pdf' ? 'all' : filters.quick,
    })
  }

  const filtered = useMemo(
    () => filterTrips(trips, filters).sort((a, b) => tripSortDate(b) - tripSortDate(a)),
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
              {(
                [
                  { id: 'all' as const, label: 'Todos' },
                  { id: 'pending_payment' as const, label: 'Pendiente de pago' },
                  { id: 'paid' as const, label: 'Pagados' },
                  { id: 'with_pdf' as const, label: 'Con PDF' },
                ] as const
              ).map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  variant={filters.quick === id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyQuickFilter(id)}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[88px]">Carga</TableHead>
                    <TableHead className="min-w-[120px]">Cliente</TableHead>
                    <TableHead className="min-w-[180px]">Ruta</TableHead>
                    <TableHead className="hidden lg:table-cell">Fechas</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[100px]">Operación</TableHead>
                    <TableHead className="min-w-[7.5rem]">Estado</TableHead>
                    <TableHead className="min-w-[6.5rem] text-right">Resultado</TableHead>
                    <TableHead className="w-10 text-center">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageTrips.map((trip) => (
                    <TableRow
                      key={trip.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/app/viajes/${trip.id}`)}
                    >
                      <TableCell className="font-mono font-medium">
                        {trip.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium truncate">
                          {trip.client?.name ?? '—'}
                        </div>
                        {trip.client?.accountId && (
                          <div className="text-xs text-muted-foreground truncate">
                            Cta. {trip.client.accountId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="truncate" title={`${trip.origin} → ${trip.destination ?? '—'}`}>
                          {trip.origin} → {trip.destination ?? '—'}
                        </div>
                        <div className="text-xs text-muted-foreground lg:hidden">
                          {formatTripDate(trip.departureDate)}
                          {trip.arrivalDate ? ` → ${formatTripDate(trip.arrivalDate)}` : ''}
                        </div>
                        <div className="text-xs text-muted-foreground md:hidden truncate">
                          {[trip.driver?.name, trip.vehicle?.plate].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        <div className="text-xs leading-tight">
                          <div>{formatTripDate(trip.departureDate)}</div>
                          {trip.arrivalDate && <div>{formatTripDate(trip.arrivalDate)}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="truncate text-sm">{trip.driver?.name ?? '—'}</div>
                        {trip.vehicle ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs text-muted-foreground truncate">{trip.vehicle.plate}</div>
                            </TooltipTrigger>
                            {trip.trailer && (
                              <TooltipContent>
                                Semi: {trip.trailer.plate}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        ) : (
                          <div className="text-xs text-muted-foreground">—</div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <TripStatusBadge status={trip.status} size="sm" className="inline-flex max-w-full" />
                      </TableCell>
                      <TableCell className="whitespace-normal text-right">
                        <TripEconomicsSummary
                          income={trip.totalIncome}
                          expenses={trip.totalExpenses}
                          variant="table"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {trip.pdfStorageKey ? (
                          <FileText className="h-4 w-4 inline text-primary" aria-label="Tiene PDF" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

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
