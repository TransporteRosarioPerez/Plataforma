'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { FormSheet } from '@/components/ui/form-sheet'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { TripFormFields } from '@/components/trips/trip-form-fields'
import { createTrip } from '@/lib/actions/trips'
import { getTripMasterPrerequisites } from '@/lib/trip-prerequisites'
import type { ArcorClient, Vehicle, Driver } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const initialState: ActionState = {}

interface NewTripSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  arcorClients: ArcorClient[]
  vehicles: Vehicle[]
  drivers: Driver[]
}

export function NewTripSheet({
  open,
  onOpenChange,
  arcorClients,
  vehicles,
  drivers,
}: NewTripSheetProps) {
  const [state, formAction, pending] = useActionState(createTrip, initialState)
  const [clientId, setClientId] = useState(arcorClients[0]?.id ?? '')
  const prerequisites = getTripMasterPrerequisites(arcorClients, vehicles, drivers)

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  useEffect(() => {
    if (arcorClients[0]?.id && !clientId) setClientId(arcorClients[0].id)
  }, [arcorClients, clientId])

  const disabled = pending || !prerequisites.canCreate

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title="Nuevo viaje"
      description="Datos operativos del viaje"
      footer={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-trip-form" className="flex-1" disabled={disabled}>
            Crear viaje
          </Button>
        </div>
      }
    >
      {!prerequisites.canCreate && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Faltan datos maestros</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Para crear un viaje necesitás:</p>
            <ul className="list-disc pl-4 space-y-1">
              {prerequisites.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/app/flota" className="underline text-sm">Flota</Link>
              <Link href="/app/choferes" className="underline text-sm">Choferes</Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <form id="new-trip-form" action={formAction} className="space-y-4">
        <TripFormFields
          mode="create"
          arcorClients={arcorClients}
          vehicles={vehicles}
          drivers={drivers}
          clientId={clientId}
          onClientIdChange={setClientId}
          disabled={disabled}
        />
      </form>
    </FormSheet>
  )
}

export const NewTripDialog = NewTripSheet
