'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { linkFuelToTrip } from '@/lib/actions/fuel-import'
import type { FuelTransaction } from '@/lib/types'
import { toast } from 'sonner'

type TripOption = {
  id: string
  code: string
  vehiclePlate?: string
  trailerPlate?: string
}

type LinkFuelTripDialogProps = {
  transaction: FuelTransaction
  trips: TripOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LinkFuelTripDialog({
  transaction,
  trips,
  open,
  onOpenChange,
}: LinkFuelTripDialogProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState(false)

  const q = search.toLowerCase()
  const filtered = trips.filter((t) => {
    if (!q) return true
    return (
      t.code.toLowerCase().includes(q) ||
      t.vehiclePlate?.toLowerCase().includes(q) ||
      t.trailerPlate?.toLowerCase().includes(q)
    )
  }).slice(0, 30)

  const handleLink = async (tripId: string) => {
    setPending(true)
    const result = await linkFuelToTrip(transaction.id, tripId)
    setPending(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      onOpenChange(false)
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular a viaje</DialogTitle>
          <DialogDescription>
            Carga del {transaction.plate} — {transaction.stationName ?? 'sin estación'}
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Buscar por código o patente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin resultados</p>
          ) : (
            filtered.map((trip) => (
              <button
                key={trip.id}
                type="button"
                disabled={pending}
                onClick={() => handleLink(trip.id)}
                className="w-full text-left rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                <span className="font-mono font-medium">{trip.code}</span>
                <span className="text-muted-foreground ml-2">
                  {trip.vehiclePlate ?? '—'}
                  {trip.trailerPlate ? ` / ${trip.trailerPlate}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
