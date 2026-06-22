'use client'

import { useEffect, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormSheet } from '@/components/ui/form-sheet'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { upsertClient } from '@/lib/actions/clients'
import type { Client } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const initialActionState: ActionState = {}

type ClientSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client | null
}

export function ClientSheet({ open, onOpenChange, client }: ClientSheetProps) {
  const [actionState, formAction, pending] = useActionState(upsertClient, initialActionState)

  useEffect(() => {
    if (actionState.success) {
      toast.success(actionState.success)
      onOpenChange(false)
    }
    if (actionState.error) toast.error(actionState.error)
  }, [actionState, onOpenChange])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="default"
      title={client ? 'Editar cliente' : 'Nuevo cliente'}
      description="Datos del cliente de facturación"
      footer={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="client-form" className="flex-1" disabled={pending}>
            {client ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      }
    >
      <form id="client-form" action={formAction} className="space-y-4">
        {client && <input type="hidden" name="id" value={client.id} />}
        <Field>
          <FieldLabel htmlFor="name">Nombre / Razón social *</FieldLabel>
          <Input id="name" name="name" defaultValue={client?.name} required disabled={pending} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cuit">CUIT</FieldLabel>
          <Input id="cuit" name="cuit" defaultValue={client?.cuit} disabled={pending} />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact_name">Contacto</FieldLabel>
          <Input id="contact_name" name="contact_name" defaultValue={client?.contactName} disabled={pending} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
            <Input id="phone" name="phone" defaultValue={client?.phone} disabled={pending} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" defaultValue={client?.email} disabled={pending} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="address">Dirección</FieldLabel>
          <Input id="address" name="address" defaultValue={client?.address} disabled={pending} />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Notas</FieldLabel>
          <Textarea id="notes" name="notes" disabled={pending} />
        </Field>
      </form>
    </FormSheet>
  )
}
