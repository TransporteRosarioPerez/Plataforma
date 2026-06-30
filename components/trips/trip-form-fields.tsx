'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel } from '@/components/ui/field'
import { ArcorClientCombobox } from '@/components/clients/arcor-client-combobox'
import { TRIP_STATUSES, tripStatusLabels, cargoTypeLabels, CARGO_TYPES } from '@/lib/types'
import type { ArcorClient, Driver, Trip, Vehicle } from '@/lib/types'

const selectClass = 'flex h-9 w-full rounded-md border px-3 text-sm'

function toDatetimeLocalValue(date?: Date) {
  if (!date) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function includeCurrent<T extends { id: string }>(items: T[], allItems: T[], currentId?: string) {
  if (!currentId || items.some((item) => item.id === currentId)) return items
  const current = allItems.find((item) => item.id === currentId)
  return current ? [current, ...items] : items
}

function includeLinkedClient(clients: ArcorClient[], trip?: Trip) {
  const linked = trip?.client ?? trip?.arcorClient
  if (!linked?.id) return clients
  if (clients.some((client) => client.id === linked.id)) return clients
  return [linked, ...clients]
}

function resolveTripClientId(trip?: Trip) {
  if (!trip) return ''
  return trip.arcorClientId ?? trip.clientId ?? trip.client?.id ?? trip.arcorClient?.id ?? ''
}

type TripFormFieldsProps = {
  mode: 'create' | 'edit'
  trip?: Trip
  arcorClients: ArcorClient[]
  vehicles: Vehicle[]
  drivers: Driver[]
  clientId: string
  onClientIdChange: (id: string) => void
  disabled?: boolean
}

export function TripFormFields({
  mode,
  trip,
  arcorClients,
  vehicles,
  drivers,
  clientId,
  onClientIdChange,
  disabled,
}: TripFormFieldsProps) {
  const clientOptions = useMemo(
    () => includeLinkedClient(arcorClients, trip),
    [arcorClients, trip]
  )
  const effectiveClientId = clientId || resolveTripClientId(trip)
  const selectedClient = clientOptions.find((c) => c.id === effectiveClientId)

  const trucks = includeCurrent(
    vehicles.filter((v) => v.type === 'truck' && v.status === 'active'),
    vehicles,
    trip?.vehicleId
  )
  const trailers = includeCurrent(
    vehicles.filter((v) => (v.type === 'semi' || v.type === 'trailer') && v.status === 'active'),
    vehicles,
    trip?.trailerId
  )
  const activeDrivers = includeCurrent(
    drivers.filter((d) => d.status === 'active'),
    drivers,
    trip?.driverId
  )

  return (
    <>
      <Field>
        <FieldLabel htmlFor="trip_code">Nº de carga *</FieldLabel>
        <Input
          id="trip_code"
          name="code"
          required
          disabled={disabled}
          defaultValue={trip?.code ?? ''}
          placeholder="Ej. 12345678"
          className="font-mono"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Número operativo que usan para identificar la carga.
        </p>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Cliente *</FieldLabel>
          <ArcorClientCombobox
            clients={clientOptions}
            value={effectiveClientId}
            onChange={onClientIdChange}
            disabled={disabled}
            autoSelectDefault={mode === 'create'}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Catálogo operativo del viaje. Para cobrar, usá tus clientes en Proformas.
          </p>
        </Field>
        <Field>
          <FieldLabel>Cantidad de clientes *</FieldLabel>
          <NumberInput
            name="number_of_clients"
            defaultValue={trip?.numberOfClients ?? 1}
            min={1}
            decimals={0}
            required
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Origen *</FieldLabel>
          <Input
            name="origin"
            required
            disabled={disabled}
            defaultValue={trip?.origin ?? ''}
            placeholder="Lugar de origen"
          />
        </Field>
        <Field>
          <FieldLabel>Destino *</FieldLabel>
          <Input
            name="destination"
            required
            disabled={disabled}
            defaultValue={trip?.destination ?? selectedClient?.address ?? ''}
            key={mode === 'create' ? clientId : undefined}
            placeholder="Localidad de entrega"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Fecha carga origen</FieldLabel>
          <Input
            name="departure_date"
            type="datetime-local"
            disabled={disabled}
            defaultValue={toDatetimeLocalValue(trip?.departureDate)}
          />
        </Field>
        <Field>
          <FieldLabel>Fecha estimada entrega</FieldLabel>
          <Input
            name="arrival_date"
            type="datetime-local"
            disabled={disabled}
            defaultValue={toDatetimeLocalValue(trip?.arrivalDate)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field>
          <FieldLabel>Tipo carga *</FieldLabel>
          <select
            name="cargo_type"
            defaultValue={trip?.cargoType ?? 'general'}
            className={selectClass}
            disabled={disabled}
          >
            {CARGO_TYPES.map((value) => (
              <option key={value} value={value}>
                {cargoTypeLabels[value]}
              </option>
            ))}
          </select>
        </Field>
        {mode === 'create' && (
          <Field>
            <FieldLabel>Estado</FieldLabel>
            <select name="status" defaultValue="incomplete" className={selectClass} disabled={disabled}>
              {TRIP_STATUSES.map((s) => (
                <option key={s} value={s}>{tripStatusLabels[s]}</option>
              ))}
            </select>
          </Field>
        )}
        <Field>
          <FieldLabel>Tipo documentación</FieldLabel>
          <select
            name="trip_type"
            defaultValue={trip?.tripType ?? 'carta_porte'}
            className={selectClass}
            disabled={disabled}
          >
            <option value="carta_porte">Con Carta de Porte</option>
            <option value="solo_remitos">Solo Remitos</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field>
          <FieldLabel>Pallets</FieldLabel>
          <NumberInput
            name="total_pallets"
            min={1}
            decimals={0}
            defaultValue={trip?.totalPallets ?? ''}
            disabled={disabled}
          />
        </Field>
        <Field>
          <FieldLabel>Bultos</FieldLabel>
          <NumberInput
            name="total_packages"
            min={1}
            decimals={0}
            defaultValue={trip?.totalPackages ?? ''}
            disabled={disabled}
          />
        </Field>
        <Field>
          <FieldLabel>Precio por pallet (estimado)</FieldLabel>
          <NumberInput
            name="unit_price"
            min={0}
            decimals={2}
            defaultValue={trip?.unitPrice ?? ''}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Estimativo al cargar el viaje. El importe real se confirma al recibir la proforma.
          </p>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel>Km Arcor</FieldLabel>
          <NumberInput
            name="km_arcor_system"
            decimals={1}
            defaultValue={trip?.kmArcorSystem ?? ''}
            disabled={disabled}
          />
        </Field>
        <Field>
          <FieldLabel>Km chofer</FieldLabel>
          <NumberInput
            name="km_real_driver"
            decimals={1}
            defaultValue={trip?.kmRealDriver ?? ''}
            disabled={disabled}
          />
        </Field>
        <Field>
          <FieldLabel>Km satélite</FieldLabel>
          <NumberInput
            name="km_satellite_google"
            decimals={1}
            defaultValue={trip?.kmSatelliteGoogle ?? ''}
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field>
          <FieldLabel>Camión *</FieldLabel>
          <select
            name="vehicle_id"
            required
            defaultValue={trip?.vehicleId ?? trucks[0]?.id ?? ''}
            className={selectClass}
            disabled={disabled}
          >
            {trucks.map((v) => (
              <option key={v.id} value={v.id}>{v.plate} — {v.brand}</option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel>Semi / Acoplado *</FieldLabel>
          <select
            name="trailer_id"
            required
            defaultValue={trip?.trailerId ?? trailers[0]?.id ?? ''}
            className={selectClass}
            disabled={disabled}
          >
            {trailers.map((v) => (
              <option key={v.id} value={v.id}>{v.plate}</option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel>Chofer *</FieldLabel>
          <select
            name="driver_id"
            required
            defaultValue={trip?.driverId ?? activeDrivers[0]?.id ?? ''}
            className={selectClass}
            disabled={disabled}
          >
            {activeDrivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field>
        <FieldLabel>Notas</FieldLabel>
        <Textarea name="notes" defaultValue={trip?.notes ?? ''} disabled={disabled} />
      </Field>
    </>
  )
}
