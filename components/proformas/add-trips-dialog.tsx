'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { BillableTripsPicker } from '@/components/proformas/billable-trips-picker'
import type { Trip } from '@/lib/types'
import type { TripLineValues } from '@/components/proformas/billable-trips-picker'

type AddTripsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trips: Trip[]
  selectedTripIds: string[]
  tripLines: Record<string, TripLineValues>
  onConfirm: (tripIds: string[]) => void
}

export function AddTripsDialog({
  open,
  onOpenChange,
  trips,
  selectedTripIds,
  tripLines,
  onConfirm,
}: AddTripsDialogProps) {
  const [draftIds, setDraftIds] = useState<string[]>(selectedTripIds)
  const [draftLines, setDraftLines] = useState<Record<string, TripLineValues>>(tripLines)

  useEffect(() => {
    if (open) {
      setDraftIds(selectedTripIds)
      setDraftLines(tripLines)
    }
  }, [open, selectedTripIds, tripLines])

  const toggleTrip = (tripId: string) => {
    setDraftIds((prev) => {
      if (prev.includes(tripId)) {
        setDraftLines((lines) => {
          const next = { ...lines }
          delete next[tripId]
          return next
        })
        return prev.filter((id) => id !== tripId)
      }
      setDraftLines((lines) => ({
        ...lines,
        [tripId]: lines[tripId] ?? { amount: '', taxes: '0' },
      }))
      return [...prev, tripId]
    })
  }

  const selectTrips = (tripIds: string[]) => {
    setDraftIds(tripIds)
    setDraftLines((lines) => {
      const next = { ...lines }
      for (const id of tripIds) {
        if (!next[id]) next[id] = { amount: '', taxes: '0' }
      }
      for (const id of Object.keys(next)) {
        if (!tripIds.includes(id)) delete next[id]
      }
      return next
    })
  }

  const clearSelection = () => {
    setDraftIds([])
    setDraftLines({})
  }

  const handleConfirm = () => {
    onConfirm(draftIds)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Elegir viajes</DialogTitle>
          <DialogDescription>
            Marcá los viajes operativos que querés incluir. Los importes los cargás después.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-4 max-h-[min(60vh,480px)] overflow-y-auto">
          <BillableTripsPicker
            variant="picker"
            trips={trips}
            selectedTripIds={draftIds}
            tripLines={draftLines}
            onToggleTrip={toggleTrip}
            onUpdateLine={() => {}}
            onSelectTrips={selectTrips}
            onClearSelection={clearSelection}
          />
        </div>
        <DialogFooter className="border-t px-6 py-4 gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm}>
            {draftIds.length === 0
              ? 'Confirmar'
              : `Confirmar (${draftIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
