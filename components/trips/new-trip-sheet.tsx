'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { FormSheet } from '@/components/ui/form-sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel } from '@/components/ui/field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ArcorClientCombobox } from '@/components/clients/arcor-client-combobox'
import { createTrip } from '@/lib/actions/trips'
import { getTripMasterPrerequisites } from '@/lib/trip-prerequisites'
import { TRIP_STATUSES, tripStatusLabels } from '@/lib/types'
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

  const selectedClient = arcorClients.find((c) => c.id === clientId)

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  useEffect(() => {
    if (arcorClients[0]?.id && !clientId) setClientId(arcorClients[0].id)
  }, [arcorClients, clientId])

  const trucks = vehicles.filter((v) => v.type === 'truck' && v.status === 'active')
  const trailers = vehicles.filter(
    (v) => (v.type === 'semi' || v.type === 'trailer') && v.status === 'active'
  )
  const activeDrivers = drivers.filter((d) => d.status === 'active')

  const selectClass = 'flex h-9 w-full rounded-md border px-3 text-sm'
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Cliente *</FieldLabel>
            <ArcorClientCombobox
              clients={arcorClients}
              value={clientId}
              onChange={setClientId}
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Catálogo operativo del viaje (clientes Arcor). Para cobrar, usá tus clientes en Proformas.
            </p>
          </Field>
          <Field>
            <FieldLabel>Cantidad de clientes *</FieldLabel>
            <Input name="number_of_clients" defaultValue="1" required disabled={disabled} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Origen *</FieldLabel>
            <Input name="origin" required disabled={disabled} placeholder="Lugar de origen" />
          </Field>
          <Field>
            <FieldLabel>Destino *</FieldLabel>
            <Input
              name="destination"
              required
              disabled={disabled}
              defaultValue={selectedClient?.address ?? ''}
              key={clientId}
              placeholder="Localidad de entrega"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Fecha carga origen</FieldLabel>
            <Input name="departure_date" type="datetime-local" disabled={disabled} />
          </Field>
          <Field>
            <FieldLabel>Fecha estimada entrega</FieldLabel>
            <Input name="arrival_date" type="datetime-local" disabled={disabled} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel>Tipo carga *</FieldLabel>
            <select name="cargo_type" defaultValue="general" className={selectClass} disabled={disabled}>
              <option value="cold_chain">Refrigerado</option>
              <option value="general">Seco / General</option>
              <option value="grains">Granos</option>
              <option value="hazmat">Peligrosa</option>
            </select>
          </Field>
          <Field>
            <FieldLabel>Estado</FieldLabel>
            <select name="status" defaultValue="incomplete" className={selectClass} disabled={disabled}>
              {TRIP_STATUSES.map((s) => (
                <option key={s} value={s}>{tripStatusLabels[s]}</option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel>Tipo documentación</FieldLabel>
            <select name="trip_type" defaultValue="carta_porte" className={selectClass} disabled={disabled}>
              <option value="carta_porte">Con Carta de Porte</option>
              <option value="solo_remitos">Solo Remitos</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel>Pallets</FieldLabel>
            <Input name="total_pallets" type="number" min={1} disabled={disabled} />
          </Field>
          <Field>
            <FieldLabel>Bultos</FieldLabel>
            <Input name="total_packages" type="number" min={1} disabled={disabled} />
          </Field>
          <Field>
            <FieldLabel>Precio por pallet (estimado)</FieldLabel>
            <Input name="unit_price" type="number" min={0} step="0.01" disabled={disabled} />
            <p className="text-xs text-muted-foreground mt-1">
              Estimativo al cargar el viaje. El importe real se confirma al recibir la proforma.
            </p>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel>Km Arcor</FieldLabel>
            <Input name="km_arcor_system" type="number" step="0.1" disabled={disabled} />
          </Field>
          <Field>
            <FieldLabel>Km chofer</FieldLabel>
            <Input name="km_real_driver" type="number" step="0.1" disabled={disabled} />
          </Field>
          <Field>
            <FieldLabel>Km satélite</FieldLabel>
            <Input name="km_satellite_google" type="number" step="0.1" disabled={disabled} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel>Camión *</FieldLabel>
            <select name="vehicle_id" required defaultValue={trucks[0]?.id ?? ''} className={selectClass} disabled={disabled}>
              {trucks.map((v) => (
                <option key={v.id} value={v.id}>{v.plate} — {v.brand}</option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel>Semi / Acoplado *</FieldLabel>
            <select name="trailer_id" required defaultValue={trailers[0]?.id ?? ''} className={selectClass} disabled={disabled}>
              {trailers.map((v) => (
                <option key={v.id} value={v.id}>{v.plate}</option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel>Chofer *</FieldLabel>
            <select name="driver_id" required defaultValue={activeDrivers[0]?.id ?? ''} className={selectClass} disabled={disabled}>
              {activeDrivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field>
          <FieldLabel>Notas</FieldLabel>
          <Textarea name="notes" disabled={disabled} />
        </Field>
      </form>
    </FormSheet>
  )
}

export const NewTripDialog = NewTripSheet
