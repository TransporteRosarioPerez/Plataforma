'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CHANNEL_LABELS, FREQUENCY_LABELS, LOAD_TYPE_LABELS, SERVICE_LABELS } from '@/lib/crm/constants'
import { parseRequestText } from '@/lib/crm/parse'
import { createManualRequest } from '@/lib/crm/server/actions-inbox'
import type { CrmChannel } from '@/lib/crm/types'
import { formatDate, useAction } from './shared'

function nowLocalInput(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const PLACEHOLDER: Record<CrmChannel, string> = {
  whatsapp: 'Pegá el chat de WhatsApp (se puede copiar con fecha y nombre, el sistema los limpia)',
  email: 'Pegá el mail completo, con la firma: de ahí sale la empresa, el CUIT y los teléfonos',
  landing: 'Mensaje del formulario',
  phone: 'Anotá lo que pidió por teléfono: empresa, ruta, pallets, servicio, fecha…',
  other: 'Mensaje',
}

export function NewRequestDialog() {
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<CrmChannel>('whatsapp')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [receivedAt, setReceivedAt] = useState(nowLocalInput)
  const { pending, run } = useAction()

  const preview = useMemo(() => (message.trim() ? parseRequestText(message, new Date(receivedAt)) : null), [message, receivedAt])

  const reset = () => {
    setMessage(''); setName(''); setCompany(''); setEmail(''); setPhone(''); setReceivedAt(nowLocalInput())
  }

  const chips: [string, string | undefined][] = preview
    ? [
        ['Empresa', preview.companyName],
        ['Contacto', preview.senderName],
        ['Mail', preview.emails?.join(', ')],
        ['Teléfono', preview.phones?.join(', ')],
        ['Origen', preview.origin],
        ['Destino', preview.destination],
        ['Pallets', preview.pallets?.toString()],
        ['Servicio', preview.serviceType && SERVICE_LABELS[preview.serviceType]],
        ['Carga', preview.loadType && LOAD_TYPE_LABELS[preview.loadType]],
        ['Fecha', preview.loadDate && formatDate(preview.loadDate)],
        ['Frecuencia', preview.frequency && FREQUENCY_LABELS[preview.frequency]],
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-1 h-4 w-4" />Cargar pedido</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cargar pedido de cotización</DialogTitle>
          <DialogDescription>
            Pegá el mensaje como llegó. Queda en la bandeja para asignarle la empresa antes de pasar al board.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as CrmChannel)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['whatsapp', 'email', 'phone', 'landing', 'other'] as CrmChannel[]).map((c) => (
                    <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="req-received">Recibido</Label>
              <Input id="req-received" type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="req-message">Mensaje</Label>
            <Textarea id="req-message" rows={8} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={PLACEHOLDER[channel]} />
          </div>
          {preview && (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Lo que se leyó del mensaje (se puede corregir en la bandeja)</p>
              <div className="flex flex-wrap gap-1.5">
                {chips.filter(([, v]) => v).map(([k, v]) => (
                  <span key={k} className="rounded bg-background px-2 py-0.5 text-xs shadow-sm"><span className="text-muted-foreground">{k}:</span> {v}</span>
                ))}
                {chips.every(([, v]) => !v) && <span className="text-xs text-muted-foreground">No se reconoció nada todavía.</span>}
              </div>
            </div>
          )}
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Completar datos a mano (opcional)</summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="req-company">Empresa</Label><Input id="req-company" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="req-name">Contacto</Label><Input id="req-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="req-email">Mail</Label><Input id="req-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="req-phone">Teléfono</Label><Input id="req-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
          </details>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  createManualRequest({
                    channel,
                    receivedAt: new Date(receivedAt).toISOString(),
                    message,
                    name: name || null,
                    company: company || null,
                    email: email || null,
                    phone: phone || null,
                  }),
                () => { setOpen(false); reset() },
              )
            }
          >
            Cargar en la bandeja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
