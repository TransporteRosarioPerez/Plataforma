'use client'

import { useEffect, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormSheet } from '@/components/ui/form-sheet'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { upsertDriver } from '@/lib/actions/drivers'
import type { Driver } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const initialState: ActionState = {}

interface DriverSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  driver?: Driver | null
}

export function DriverSheet({ open, onOpenChange, driver }: DriverSheetProps) {
  const [state, formAction, pending] = useActionState(upsertDriver, initialState)

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
      title={driver ? 'Editar chofer' : 'Nuevo chofer'}
      description="Datos del conductor"
      footer={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="driver-form" className="flex-1" disabled={pending}>
            {driver ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      }
    >
      <form id="driver-form" action={formAction}>
        <FieldGroup className="gap-4">
          {driver && <input type="hidden" name="id" value={driver.id} />}
          <Field>
            <FieldLabel htmlFor="name">Nombre *</FieldLabel>
            <Input id="name" name="name" defaultValue={driver?.name} required disabled={pending} />
          </Field>
          <Field>
            <FieldLabel htmlFor="dni">DNI *</FieldLabel>
            <Input id="dni" name="dni" defaultValue={driver?.dni} required disabled={pending} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="license_number">N° licencia</FieldLabel>
              <Input
                id="license_number"
                name="license_number"
                defaultValue={driver?.licenseNumber}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="license_expiry">Vencimiento licencia</FieldLabel>
              <Input
                id="license_expiry"
                name="license_expiry"
                type="date"
                defaultValue={
                  driver?.licenseExpiry
                    ? new Date(driver.licenseExpiry).toISOString().slice(0, 10)
                    : undefined
                }
                disabled={pending}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
              <Input id="phone" name="phone" defaultValue={driver?.phone} disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" defaultValue={driver?.email} disabled={pending} />
            </Field>
          </div>
          <Field>
            <FieldLabel>Estado</FieldLabel>
            <select
              name="status"
              defaultValue={driver?.status ?? 'active'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              disabled={pending}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </Field>
        </FieldGroup>
      </form>
    </FormSheet>
  )
}

export const DriverDialog = DriverSheet
