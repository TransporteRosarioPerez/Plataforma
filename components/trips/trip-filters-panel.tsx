'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  cargoTypeLabels,
  tripTypeLabels,
  type ArcorClient,
  type Driver,
  type Vehicle,
} from '@/lib/types'
import {
  countCustomTripFilters,
  type TripListFilters,
} from '@/lib/trips/list-filters'

type TripFiltersPanelProps = {
  filters: TripListFilters
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<TripListFilters>) => void
  onClearCustom: () => void
  clients: ArcorClient[]
  drivers: Driver[]
  vehicles: Vehicle[]
}

export function TripFiltersPanel({
  filters,
  open,
  onOpenChange,
  onChange,
  onClearCustom,
  clients,
  drivers,
  vehicles,
}: TripFiltersPanelProps) {
  const customCount = countCustomTripFilters(filters)

  const trucks = vehicles.filter((v) => v.type === 'truck' || v.type === 'semi')
  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const sortedDrivers = [...drivers].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const sortedVehicles = [...trucks].sort((a, b) => a.plate.localeCompare(b.plate, 'es'))

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-wrap items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros personalizados
            {customCount > 0 && (
              <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-xs">
                {customCount}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        {customCount > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearCustom} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-4">
        <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="trip-filter-client">Cliente</Label>
            <Select
              value={filters.clientId}
              onValueChange={(value) => onChange({ clientId: value })}
            >
              <SelectTrigger id="trip-filter-client" className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {sortedClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                    {client.accountId ? ` (${client.accountId})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-filter-driver">Chofer</Label>
            <Select
              value={filters.driverId}
              onValueChange={(value) => onChange({ driverId: value })}
            >
              <SelectTrigger id="trip-filter-driver" className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los choferes</SelectItem>
                {sortedDrivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-filter-vehicle">Camión / patente</Label>
            <Select
              value={filters.vehicleId}
              onValueChange={(value) => onChange({ vehicleId: value })}
            >
              <SelectTrigger id="trip-filter-vehicle" className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las patentes</SelectItem>
                {sortedVehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate}
                    {vehicle.brand ? ` · ${vehicle.brand}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-filter-trip-type">Tipo de viaje</Label>
            <Select
              value={filters.tripType}
              onValueChange={(value) =>
                onChange({ tripType: value as TripListFilters['tripType'] })
              }
            >
              <SelectTrigger id="trip-filter-trip-type" className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(tripTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-filter-cargo-type">Tipo de carga</Label>
            <Select
              value={filters.cargoType}
              onValueChange={(value) =>
                onChange({ cargoType: value as TripListFilters['cargoType'] })
              }
            >
              <SelectTrigger id="trip-filter-cargo-type" className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(cargoTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-filter-pdf">PDF del viaje</Label>
            <Select
              value={filters.pdf}
              onValueChange={(value) =>
                onChange({
                  pdf: value as TripListFilters['pdf'],
                  quick: value === 'yes' ? 'with_pdf' : 'all',
                })
              }
            >
              <SelectTrigger id="trip-filter-pdf" className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Con PDF</SelectItem>
                <SelectItem value="no">Sin PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-filter-from">Salida desde</Label>
            <Input
              id="trip-filter-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onChange({ dateFrom: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-filter-to">Salida hasta</Label>
            <Input
              id="trip-filter-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => onChange({ dateTo: e.target.value })}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
