'use client'

import { useEffect, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormSheet } from '@/components/ui/form-sheet'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { upsertVehicle } from '@/lib/actions/vehicles'
import type { Vehicle } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 30 }, (_, i) => currentYear - i)
const initialState: ActionState = {}

interface VehicleSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle | null
}

export function VehicleSheet({ open, onOpenChange, vehicle }: VehicleSheetProps) {
  const [state, formAction, pending] = useActionState(upsertVehicle, initialState)

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
      onOpenChange(false)
    }
    if (state.error) toast.error(state.error)
  }, [state, onOpenChange])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="default"
      title={vehicle ? 'Editar vehículo' : 'Nuevo vehículo'}
      description="Datos del camión, semi o acoplado"
      footer={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="vehicle-form" className="flex-1" disabled={pending}>
            {vehicle ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      }
    >
      <form id="vehicle-form" action={formAction}>
        <FieldGroup className="gap-4">
          {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
          <Field>
            <FieldLabel htmlFor="plate">Patente *</FieldLabel>
            <Input id="plate" name="plate" defaultValue={vehicle?.plate} required disabled={pending} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="brand">Marca *</FieldLabel>
              <Input id="brand" name="brand" defaultValue={vehicle?.brand} required disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="model">Modelo *</FieldLabel>
              <Input id="model" name="model" defaultValue={vehicle?.model} required disabled={pending} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="year">Año *</FieldLabel>
              <select
                id="year"
                name="year"
                defaultValue={vehicle?.year ?? currentYear}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                disabled={pending}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>Tipo *</FieldLabel>
              <select
                name="type"
                defaultValue={vehicle?.type ?? 'truck'}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                disabled={pending}
              >
                <option value="truck">Camión</option>
                <option value="semi">Semi</option>
                <option value="trailer">Acoplado</option>
              </select>
            </Field>
          </div>
          <Field>
            <FieldLabel>Estado *</FieldLabel>
            <select
              name="status"
              defaultValue={vehicle?.status ?? 'active'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              disabled={pending}
            >
              <option value="active">Activo</option>
              <option value="maintenance">En mantenimiento</option>
              <option value="inactive">Inactivo</option>
            </select>
          </Field>
        </FieldGroup>
      </form>
    </FormSheet>
  )
}

// Alias for gradual migration
export const VehicleDialog = VehicleSheet
