'use client'

import { useEffect, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormSheet } from '@/components/ui/form-sheet'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { upsertArcorClient } from '@/lib/actions/arcor-clients'
import type { ArcorClient } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const initialActionState: ActionState = {}

type ArcorClientSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: ArcorClient | null
}

export function ArcorClientSheet({ open, onOpenChange, client }: ArcorClientSheetProps) {
  const [actionState, formAction, pending] = useActionState(upsertArcorClient, initialActionState)

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
      title={client ? 'Editar cuenta de viaje' : 'Nueva cuenta de viaje'}
      description="Cliente operativo del catálogo usado al cargar viajes"
      footer={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="arcor-client-form" className="flex-1" disabled={pending}>
            {client ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      }
    >
      <form id="arcor-client-form" action={formAction} className="space-y-4">
        {client && <input type="hidden" name="id" value={client.id} />}
        <Field>
          <FieldLabel htmlFor="account_id">Nº de cliente</FieldLabel>
          <Input
            id="account_id"
            name="account_id"
            defaultValue={client?.accountId ?? ''}
            placeholder="Ej. 12345"
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="name">Nombre *</FieldLabel>
          <Input id="name" name="name" defaultValue={client?.name} required disabled={pending} />
        </Field>
        <Field>
          <FieldLabel htmlFor="address">Dirección</FieldLabel>
          <Input id="address" name="address" defaultValue={client?.address ?? ''} disabled={pending} />
        </Field>
      </form>
    </FormSheet>
  )
}
