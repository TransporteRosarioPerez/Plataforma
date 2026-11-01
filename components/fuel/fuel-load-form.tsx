'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/components/ui/form-sheet'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { upsertFuelLoad } from '@/lib/actions/fuel'
import type { ActionState } from '@/lib/validations/parse-form'
import type { FuelPaymentMethod, FuelTransaction } from '@/lib/types'
import { formatPricePerLiter, paymentMethodLabels, vehicleTypeLabel } from '@/components/fuel/format'

export type FleetVehicle = {
  id: string
  plate: string
  brand?: string
  type: 'truck' | 'semi' | 'trailer'
  status: 'active' | 'maintenance' | 'inactive'
}
export type FleetDriver = { id: string; name: string; status: 'active' | 'inactive' }

const selectClass =
  'flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50'

const initialState: ActionState = {}

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
}

function isoInArgentina(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d)
}

type FuelLoadFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: FuelTransaction | null
  vehicles: FleetVehicle[]
  drivers: FleetDriver[]
}

export function FuelLoadForm({ open, onOpenChange, editing, vehicles, drivers }: FuelLoadFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(upsertFuelLoad, initialState)
  const [formKey, setFormKey] = useState(0)
  const keepOpen = useRef(false)
  const lastDate = useRef(todayIso())
  const lastPayment = useRef<FuelPaymentMethod | ''>('cuenta_corriente')
  const lastDriver = useRef('')

  const [vehicleId, setVehicleId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [liters, setLiters] = useState<number | undefined>()
  const [total, setTotal] = useState<number | undefined>()
  const [payment, setPayment] = useState<FuelPaymentMethod | ''>('cuenta_corriente')

  useEffect(() => {
    if (!open) return
    setVehicleId(editing?.vehicleId ?? '')
    setDriverId(editing ? editing.driverId ?? '' : lastDriver.current)
    setLiters(editing?.liters)
    setTotal(editing && editing.amountTotal > 0 ? editing.amountTotal : undefined)
    setPayment(editing ? editing.paymentMethod ?? '' : lastPayment.current)
    setFormKey((k) => k + 1)
  }, [open, editing])

  useEffect(() => {
    if (state.error) toast.error(state.error)
    if (!state.success) return
    toast.success(state.success)
    router.refresh()
    if (keepOpen.current && !editing) {
      // Siguiente renglón de la planilla: se mantiene fecha, chofer y forma de pago.
      setVehicleId('')
      setLiters(undefined)
      setTotal(undefined)
      setFormKey((k) => k + 1)
    } else {
      onOpenChange(false)
    }
  }, [state])

  // Inactivos solo aparecen si la carga que se edita ya los tenía.
  const trucks = useMemo(
    () => vehicles.filter((v) => v.type === 'truck' && (v.status !== 'inactive' || v.id === editing?.vehicleId)),
    [vehicles, editing]
  )
  const semis = useMemo(
    () => vehicles.filter((v) => v.type !== 'truck' && (v.status !== 'inactive' || v.id === editing?.vehicleId)),
    [vehicles, editing]
  )
  const driverOptions = useMemo(
    () => drivers.filter((d) => d.status !== 'inactive' || d.id === editing?.driverId),
    [drivers, editing]
  )
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)

  const price = liters && total ? total / liters : null

  const defaultDate = editing ? isoInArgentina(editing.transactionAt) : lastDate.current

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="narrow"
      title={editing ? 'Editar carga' : 'Nueva carga de combustible'}
      description="Un renglón de la planilla: patente, chofer, fecha, litros y lo que se pagó."
      footer={
        <div className="flex w-full flex-wrap gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {!editing && (
            <Button
              type="submit"
              form="fuel-load-form"
              variant="secondary"
              className="flex-1"
              disabled={pending}
              onClick={() => (keepOpen.current = true)}
            >
              Guardar y cargar otra
            </Button>
          )}
          <Button
            type="submit"
            form="fuel-load-form"
            className="flex-1"
            disabled={pending}
            onClick={() => (keepOpen.current = false)}
          >
            {editing ? 'Guardar' : 'Registrar'}
          </Button>
        </div>
      }
    >
      <form
        key={formKey}
        id="fuel-load-form"
        action={(fd) => {
          lastDate.current = String(fd.get('load_date') ?? lastDate.current)
          lastPayment.current = payment
          lastDriver.current = driverId
          formAction(fd)
        }}
        className="space-y-4"
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <input type="hidden" name="payment_method" value={payment} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Patente *</FieldLabel>
            <select
              name="vehicle_id"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className={`${selectClass} font-mono`}
              required
              autoFocus
              disabled={pending}
            >
              <option value="">Seleccionar</option>
              {trucks.length > 0 && (
                <optgroup label="Camiones">
                  {trucks.map((v) => (
                    <option key={v.id} value={v.id}>{v.plate}{v.brand ? ` — ${v.brand}` : ''}</option>
                  ))}
                </optgroup>
              )}
              {semis.length > 0 && (
                <optgroup label="Semis / térmicos">
                  {semis.map((v) => (
                    <option key={v.id} value={v.id}>{v.plate}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {selectedVehicle && <FieldDescription>{vehicleTypeLabel(selectedVehicle.type)}</FieldDescription>}
            {vehicles.length === 0 && (
              <FieldDescription>No hay vehículos cargados. Agregalos en Flota.</FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel>Fecha *</FieldLabel>
            <Input name="load_date" type="date" defaultValue={defaultDate} required disabled={pending} />
          </Field>
        </div>

        <Field>
          <FieldLabel>Chofer</FieldLabel>
          <select
            name="driver_id"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className={selectClass}
            disabled={pending}
          >
            <option value="">Sin chofer</option>
            {driverOptions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Litros *</FieldLabel>
            <NumberInput
              name="liters"
              decimals={2}
              min={0.01}
              defaultValue={editing?.liters ?? ''}
              onValueChange={setLiters}
              required
              disabled={pending}
            />
          </Field>
          <Field>
            <FieldLabel>Total pagado $</FieldLabel>
            <NumberInput
              name="amount_total"
              decimals={2}
              min={0}
              defaultValue={editing && editing.amountTotal > 0 ? editing.amountTotal : ''}
              onValueChange={setTotal}
              disabled={pending}
            />
            <FieldDescription>
              {price ? `${formatPricePerLiter(price)} por litro` : 'Si todavía no tenés el precio, dejalo vacío'}
            </FieldDescription>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Km del odómetro</FieldLabel>
            <NumberInput
              name="odometer_km"
              decimals={0}
              min={0}
              defaultValue={editing?.odometerKm ?? ''}
              disabled={pending}
            />
            <FieldDescription>Opcional. Con 2 o más lecturas calcula L/100 km.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Forma de pago</FieldLabel>
            <Select value={payment || 'none'} onValueChange={(v) => setPayment(v === 'none' ? '' : (v as FuelPaymentMethod))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin definir</SelectItem>
                {(Object.keys(paymentMethodLabels) as FuelPaymentMethod[]).map((k) => (
                  <SelectItem key={k} value={k}>{paymentMethodLabels[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Estación / proveedor</FieldLabel>
            <Input name="station_name" defaultValue={editing?.stationName ?? ''} disabled={pending} />
          </Field>
          <Field>
            <FieldLabel>N° de ticket / remito</FieldLabel>
            <Input name="ticket_number" defaultValue={editing?.ticketNumber ?? ''} disabled={pending} />
          </Field>
        </div>

        <Field>
          <FieldLabel>Notas</FieldLabel>
          <Textarea name="notes" rows={2} defaultValue={editing?.notes ?? ''} disabled={pending} />
        </Field>

      </form>
    </FormSheet>
  )
}
