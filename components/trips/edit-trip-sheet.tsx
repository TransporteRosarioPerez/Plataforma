'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormSheet } from '@/components/ui/form-sheet'
import { Button } from '@/components/ui/button'
import { TripFormFields } from '@/components/trips/trip-form-fields'
import { updateTrip } from '@/lib/actions/trips'
import type { ArcorClient, Driver, Trip, Vehicle } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const initialState: ActionState = {}

type EditTripSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip: Trip
  arcorClients: ArcorClient[]
  vehicles: Vehicle[]
  drivers: Driver[]
}

export function EditTripSheet({
  open,
  onOpenChange,
  trip,
  arcorClients,
  vehicles,
  drivers,
}: EditTripSheetProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateTrip, initialState)
  const [clientId, setClientId] = useState(trip.arcorClientId ?? trip.client?.id ?? '')

  useEffect(() => {
    if (!open) return
    setClientId(trip.arcorClientId ?? trip.client?.id ?? '')
  }, [open, trip.arcorClientId, trip.client?.id])

  useEffect(() => {
    if (state.error) toast.error(state.error)
    if (state.success) {
      toast.success(state.success)
      onOpenChange(false)
      router.refresh()
    }
  }, [state, onOpenChange, router])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title="Editar viaje"
      description={`Modificar datos operativos de ${trip.code}`}
      footer={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-trip-form" className="flex-1" disabled={pending}>
            Guardar cambios
          </Button>
        </div>
      }
    >
      <form id="edit-trip-form" action={formAction} className="space-y-4">
        <input type="hidden" name="trip_id" value={trip.id} />
        <TripFormFields
          mode="edit"
          trip={trip}
          arcorClients={arcorClients}
          vehicles={vehicles}
          drivers={drivers}
          clientId={clientId}
          onClientIdChange={setClientId}
          disabled={pending}
        />
      </form>
    </FormSheet>
  )
}
