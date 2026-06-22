'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { updateCompanySettings } from '@/lib/actions/company'
import { EntityDocumentsPanel } from '@/components/documents/entity-documents-panel'
import type { DbCompanySettings } from '@/lib/db/mappers'
import type { DocumentRecord } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const initialState: ActionState = {}

type EmpresaConfigViewProps = {
  company: DbCompanySettings
  companyDocuments: DocumentRecord[]
  companyDocumentHistory: DocumentRecord[]
}

export function EmpresaConfigView({
  company,
  companyDocuments,
  companyDocumentHistory,
}: EmpresaConfigViewProps) {
  const [state, formAction, pending] = useActionState(updateCompanySettings, initialState)

  useEffect(() => {
    if (state.success) toast.success(state.success)
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/configuracion"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Datos de la empresa</h1>
          <p className="text-muted-foreground">Información fiscal y documentación de la empresa</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
          <CardDescription>Información fiscal y de contacto</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4 max-w-lg">
            <input type="hidden" name="id" value={company.id} />
            <Field>
              <FieldLabel htmlFor="name">Razón social *</FieldLabel>
              <Input id="name" name="name" defaultValue={company.name} required disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cuit">CUIT</FieldLabel>
              <Input id="cuit" name="cuit" defaultValue={company.cuit ?? ''} disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="address">Domicilio</FieldLabel>
              <Input id="address" name="address" defaultValue={company.address ?? ''} disabled={pending} />
            </Field>
            <Button type="submit" disabled={pending}>Guardar</Button>
          </form>
        </CardContent>
      </Card>

      <EntityDocumentsPanel
        entityId={company.id}
        entityType="company"
        documents={companyDocuments}
        history={companyDocumentHistory}
      />
    </div>
  )
}
