'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { updateAlertSettings } from '@/lib/actions/alert-settings'
import type { DbCompanySettings } from '@/lib/db/mappers'
import type { WhatsAppProviderStatus } from '@/lib/notifications/whatsapp/config'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const initialState: ActionState = {}

const providerLabels = {
  twilio: 'Twilio WhatsApp',
  meta: 'Meta Cloud API',
} as const

type NotificacionesConfigFormProps = {
  company: DbCompanySettings
  providerStatus: WhatsAppProviderStatus
}

export function NotificacionesConfigForm({
  company,
  providerStatus,
}: NotificacionesConfigFormProps) {
  const [enabled, setEnabled] = useState(company.alert_enabled ?? false)
  const [state, formAction, pending] = useActionState(updateAlertSettings, initialState)
  const alertDays = company.alert_days_before ?? 7

  useEffect(() => {
    if (state.success) toast.success(state.success)
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/configuracion"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Alertas WhatsApp</h1>
          <p className="text-muted-foreground">
            Avisos preventivos antes del vencimiento
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Proveedor
            {providerStatus.configured ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Configurado
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/30">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Faltan env vars
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {providerStatus.provider
              ? `Activo: ${providerLabels[providerStatus.provider]} (variable WHATSAPP_PROVIDER)`
              : 'Definí WHATSAPP_PROVIDER=twilio o meta'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {providerStatus.provider === 'twilio' && (
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><code className="text-xs">TWILIO_ACCOUNT_SID</code></li>
              <li><code className="text-xs">TWILIO_AUTH_TOKEN</code></li>
              <li><code className="text-xs">TWILIO_WHATSAPP_FROM</code> (sandbox o número productivo)</li>
            </ul>
          )}
          {providerStatus.provider === 'meta' && (
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><code className="text-xs">WHATSAPP_ACCESS_TOKEN</code></li>
              <li><code className="text-xs">WHATSAPP_PHONE_NUMBER_ID</code></li>
            </ul>
          )}
          {!providerStatus.configured && providerStatus.missing.length > 0 && (
            <p className="text-destructive text-xs mt-2">
              Faltan: {providerStatus.missing.join(', ')}
            </p>
          )}
          <p className="text-xs text-muted-foreground pt-2">
            Las credenciales van en <code>.env.local</code> / Vercel, no en la base de datos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Destinatarios y anticipación</CardTitle>
          <CardDescription>
            Un resumen diario por WhatsApp solo con documentos <strong>por vencer</strong>.
            Los ya vencidos se ven en Vencimientos, pero no generan mensaje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={company.id} />
            <input type="hidden" name="alert_enabled" value={enabled ? 'true' : 'false'} />

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Alertas activas</p>
                <p className="text-sm text-muted-foreground">
                  Cron diario ~08:00 ART (11:00 UTC en Vercel)
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={pending} />
            </div>

            <Field>
              <FieldLabel htmlFor="alert_whatsapp_phones">Teléfonos destino</FieldLabel>
              <Textarea
                id="alert_whatsapp_phones"
                name="alert_whatsapp_phones"
                rows={3}
                placeholder="5493411234567&#10;5493417654321"
                defaultValue={(company.alert_whatsapp_phones ?? []).join('\n')}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Un número por línea, formato internacional sin +. Máximo ~1 mensaje/día por teléfono cuando hay avisos.
              </p>
            </Field>

            <Field>
              <FieldLabel htmlFor="alert_days_before">Días de anticipación</FieldLabel>
              <Input
                id="alert_days_before"
                name="alert_days_before"
                type="number"
                min={1}
                max={90}
                defaultValue={alertDays}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Todos los documentos entran en alerta {alertDays} días antes del vencimiento.
                WhatsApp avisa al entrar en esa ventana y otra vez a 3 días del vencimiento (máx. 2 avisos por documento).
              </p>
            </Field>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Costo estimado:</strong> 1 mensaje agrupado × cantidad de teléfonos por día con avisos (no 1 por documento).</p>
              <p>Documentos vencidos: solo en la pantalla Vencimientos, sin WhatsApp.</p>
            </div>

            <Button type="submit" disabled={pending}>Guardar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
