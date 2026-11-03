'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { TripStatusBadge } from '@/components/trip-status-badge'
import type { Trip } from '@/lib/types'
import type { TripBillingHistoryEntry } from '@/lib/proformas/trip-estimate-amount'

const MAX_VISIBLE = 60

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

function tripRouteLabel(trip: Trip) {
  if (trip.origin && trip.destination) return `${trip.origin} → ${trip.destination}`
  return trip.origin || trip.destination || '—'
}

function tripSortDate(trip: Trip) {
  return trip.departureDate?.getTime() ?? trip.createdAt.getTime()
}

function matches(trip: Trip, history: TripBillingHistoryEntry[], q: string) {
  if (!q) return true
  return (
    trip.code.toLowerCase().includes(q) ||
    trip.origin.toLowerCase().includes(q) ||
    (trip.destination?.toLowerCase().includes(q) ?? false) ||
    (trip.arcorClient?.name.toLowerCase().includes(q) ?? false) ||
    (trip.driver?.name.toLowerCase().includes(q) ?? false) ||
    (trip.vehicle?.plate.toLowerCase().includes(q) ?? false) ||
    history.some((h) => h.proformaNumber.toLowerCase().includes(q))
  )
}

type AddAdjustmentTripsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Viajes ya incluidos en otra proforma activa (facturados o cobrados). */
  trips: Trip[]
  /** Viajes que ya están en esta proforma (no se pueden repetir). */
  excludeTripIds: string[]
  history: Record<string, TripBillingHistoryEntry[]>
  onConfirm: (tripIds: string[]) => void
}

export function AddAdjustmentTripsDialog({
  open,
  onOpenChange,
  trips,
  excludeTripIds,
  history,
  onConfirm,
}: AddAdjustmentTripsDialogProps) {
  const [search, setSearch] = useState('')
  const [onlyPaid, setOnlyPaid] = useState(true)
  const [draftIds, setDraftIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setSearch('')
      setOnlyPaid(true)
      setDraftIds([])
    }
  }, [open])

  const candidates = useMemo(() => {
    const excluded = new Set(excludeTripIds)
    const q = search.trim().toLowerCase()
    return trips
      .filter((trip) => !excluded.has(trip.id))
      .filter((trip) => !onlyPaid || trip.status === 'paid')
      .filter((trip) => matches(trip, history[trip.id] ?? [], q))
      .sort((a, b) => tripSortDate(b) - tripSortDate(a))
  }, [trips, excludeTripIds, search, onlyPaid, history])

  const visible = candidates.slice(0, MAX_VISIBLE)

  const toggle = (tripId: string) => {
    setDraftIds((prev) =>
      prev.includes(tripId) ? prev.filter((id) => id !== tripId) : [...prev, tripId]
    )
  }

  const handleConfirm = () => {
    onConfirm(draftIds)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Ajuste de viaje</DialogTitle>
          <DialogDescription>
            Elegí viajes que ya se facturaron o cobraron en otra proforma. En cada uno cargás solo
            la diferencia: se suma (o resta) al ingreso del viaje y queda registrado el ajuste.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº de viaje, proforma, cliente, ruta…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              autoFocus
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
            <Checkbox checked={onlyPaid} onCheckedChange={(v) => setOnlyPaid(v === true)} />
            Solo viajes pagados
          </label>
        </div>

        <div className="px-6 pb-4 max-h-[min(55vh,440px)] overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4 text-center">
              {trips.length === 0
                ? 'Todavía no hay viajes facturados o cobrados para ajustar.'
                : 'No hay viajes que coincidan con la búsqueda.'}
            </p>
          ) : (
            <div className="rounded-lg border divide-y">
              {visible.map((trip) => {
                const entries = history[trip.id] ?? []
                const billed = entries.reduce((sum, e) => sum + e.amount, 0)
                const previousAdjustments = entries.filter((e) => e.isAdjustment).length
                const checked = draftIds.includes(trip.id)
                return (
                  <label
                    key={trip.id}
                    className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(trip.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{trip.code}</span>
                        <span className="text-xs text-muted-foreground">
                          {trip.departureDate ? dateFormatter.format(trip.departureDate) : '—'}
                        </span>
                        <TripStatusBadge status={trip.status} size="sm" compact />
                        {previousAdjustments > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {previousAdjustments} ajuste{previousAdjustments === 1 ? '' : 's'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {tripRouteLabel(trip)}
                        {trip.arcorClient?.name ? ` · ${trip.arcorClient.name}` : ''}
                      </p>
                      <p className="text-xs">
                        Facturado {formatCurrency(billed)}
                        {entries.length > 0 && (
                          <span className="text-muted-foreground">
                            {' · '}
                            {entries.map((e) => e.proformaNumber).join(', ')}
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
          {candidates.length > MAX_VISIBLE && (
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Mostrando {MAX_VISIBLE} de {candidates.length}. Buscá para afinar.
            </p>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4 gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={draftIds.length === 0} onClick={handleConfirm}>
            {draftIds.length === 0 ? 'Agregar ajuste' : `Agregar ajuste (${draftIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
