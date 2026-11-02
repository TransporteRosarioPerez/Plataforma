'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Mail, MessageCircle, Send, Trash2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { STAGE_LABELS, STAGES } from '@/lib/crm/constants'
import { provinceOf } from '@/lib/crm/places'
import { suggestPrice } from '@/lib/crm/pricing'
import { buildQuoteMessage, mailtoLink, quoteCode, whatsappLink } from '@/lib/crm/quote-message'
import { addQuoteNote, deleteQuote, markQuoteSent, moveQuote, updateQuote } from '@/lib/crm/server/actions-quotes'
import type { CrmContact, CrmInboundRequest, CrmQuote, CrmQuoteEvent, CrmRate, CrmStage } from '@/lib/crm/types'
import { cn } from '@/lib/utils'
import { CompanyPicker, type CompanyOption } from './company-picker'
import { QuoteFields, type QuoteFieldsValue } from './quote-fields'
import { ChannelBadge, formatDateTime, formatMoney, useAction } from './shared'
import { needsExtra, StageDialog, type StageRequest } from './stage-dialogs'

const NONE = '__none'

type Props = {
  quote: CrmQuote
  events: CrmQuoteEvent[]
  request: CrmInboundRequest | null
  companies: CompanyOption[]
  contacts: CrmContact[]
  rates: CrmRate[]
}

export function QuoteDetailView({ quote, events, request, companies, contacts, rates }: Props) {
  const router = useRouter()
  const { pending, run } = useAction()
  const [companyId, setCompanyId] = useState(quote.companyId)
  const [contactId, setContactId] = useState<string | null>(quote.contactId)
  const [fields, setFields] = useState<QuoteFieldsValue>({
    origin: quote.origin ?? '',
    destination: quote.destination ?? '',
    serviceType: quote.serviceType,
    loadType: quote.loadType,
    pallets: quote.pallets,
    weightKg: quote.weightKg,
    loadDate: quote.loadDate,
    frequency: quote.frequency,
  })
  const [description, setDescription] = useState(quote.description ?? '')
  const [amount, setAmount] = useState<number | undefined>(quote.quotedAmount ?? undefined)
  const [validUntil, setValidUntil] = useState(quote.validUntil ?? '')
  const [followup, setFollowup] = useState(quote.nextFollowupAt ?? '')
  const [stageReq, setStageReq] = useState<StageRequest>(null)
  const [note, setNote] = useState('')

  const companyContacts = contacts.filter((c) => c.companyId === companyId)
  const contact = companyContacts.find((c) => c.id === contactId) ?? null

  const suggestion = useMemo(() => {
    const province = provinceOf(fields.destination)
    const rate = rates.find((r) => r.province === province)
    return suggestPrice(rate, fields)
  }, [fields, rates])

  const generated = useMemo(
    () =>
      buildQuoteMessage({
        number: quote.number,
        contactName: contact?.name ?? null,
        serviceType: fields.serviceType,
        loadType: fields.loadType,
        pallets: fields.pallets,
        weightKg: fields.weightKg,
        origin: fields.origin || null,
        destination: fields.destination || null,
        loadDate: fields.loadDate,
        frequency: fields.frequency,
        quotedAmount: amount ?? null,
        validUntil: validUntil || null,
      }),
    [quote.number, contact, fields, amount, validUntil],
  )
  const [messageEdited, setMessageEdited] = useState<string | null>(null)
  const message = messageEdited ?? generated

  const dirty =
    companyId !== quote.companyId ||
    contactId !== quote.contactId ||
    JSON.stringify(fields) !==
      JSON.stringify({ origin: quote.origin ?? '', destination: quote.destination ?? '', serviceType: quote.serviceType, loadType: quote.loadType, pallets: quote.pallets, weightKg: quote.weightKg, loadDate: quote.loadDate, frequency: quote.frequency }) ||
    description !== (quote.description ?? '') ||
    (amount ?? null) !== quote.quotedAmount ||
    validUntil !== (quote.validUntil ?? '') ||
    followup !== (quote.nextFollowupAt ?? '')

  const save = (after?: () => void) =>
    run(
      () =>
        updateQuote({
          id: quote.id,
          companyId,
          contactId,
          ...fields,
          origin: fields.origin || null,
          destination: fields.destination || null,
          description: description || null,
          quotedAmount: amount ?? null,
          validUntil: validUntil || null,
          nextFollowupAt: followup || null,
        }),
      () => after?.(),
    )

  const setStage = (stage: CrmStage) => {
    if (stage === quote.stage) return
    const q = { ...quote, quotedAmount: amount ?? quote.quotedAmount }
    if (needsExtra(q, stage)) setStageReq({ quote: q, stage, position: quote.position })
    else run(() => moveQuote({ id: quote.id, stage, position: quote.position, quotedAmount: amount ?? null }))
  }

  const send = (via: 'whatsapp' | 'email' | 'copy') => {
    if (!amount) {
      toast.error('Cargá el precio cotizado antes de enviar')
      return
    }
    if (via === 'copy') {
      navigator.clipboard.writeText(message).then(() => toast.success('Texto copiado'))
    } else {
      const link =
        via === 'whatsapp'
          ? whatsappLink(contact?.phone, message)
          : mailtoLink(contact?.email, `Cotización ${quoteCode(quote.number)} — Transporte Rosario Perez`, message)
      if (!link) {
        toast.error(via === 'whatsapp' ? 'El contacto no tiene teléfono' : 'El contacto no tiene mail')
        return
      }
      window.open(link, '_blank', 'noopener')
    }
    const doMark = () => run(() => markQuoteSent(quote.id, via))
    if (dirty) save(doMark)
    else doMark()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/app/crm"><ArrowLeft className="mr-1 h-4 w-4" />Board</Link></Button>
        <h2 className="text-lg font-semibold">{quoteCode(quote.number)} · <Link href={`/app/crm/empresas/${quote.companyId}`} className="hover:underline">{quote.companyName}</Link></h2>
        <ChannelBadge channel={quote.channel} />
        <span className="text-sm text-muted-foreground">Recibida {formatDateTime(quote.receivedAt)}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive"
          disabled={pending}
          onClick={() => {
            if (window.confirm('¿Enviar esta cotización a la papelera?')) run(() => deleteQuote(quote.id), () => router.push('/app/crm'))
          }}
        >
          <Trash2 className="mr-1 h-4 w-4" />Papelera
        </Button>
      </div>

      {/* Etapas */}
      <div className="flex flex-wrap gap-1 rounded-lg border p-1">
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => setStage(s)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm transition-colors',
              s === quote.stage ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {STAGE_LABELS[s]}
          </button>
        ))}
      </div>
      {quote.stage === 'perdida' && (
        <p className="text-sm text-muted-foreground">Perdida: {quote.lostReason}{quote.lostNotes ? ` — ${quote.lostNotes}` : ''}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Datos del pedido</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Empresa</Label>
                  <CompanyPicker companies={companies} value={companyId} onChange={(id) => { setCompanyId(id); setContactId(null) }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contacto</Label>
                  <Select value={contactId ?? NONE} onValueChange={(v) => setContactId(v === NONE ? null : v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin contacto</SelectItem>
                      {companyContacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{[c.name, c.phone, c.email].filter(Boolean).join(' · ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <QuoteFields idPrefix="quote" value={fields} onChange={setFields} />
              <div className="space-y-1">
                <Label htmlFor="quote-desc" className="text-xs">Notas del pedido (mercadería, condiciones, horarios…)</Label>
                <Textarea id="quote-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Precio</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="quote-amount" className="text-xs">Precio cotizado (sin IVA)</Label>
                  <NumberInput id="quote-amount" value={amount ?? ''} onValueChange={setAmount} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="quote-valid" className="text-xs">Válida hasta</Label>
                  <Input id="quote-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="quote-follow" className="text-xs">Próximo seguimiento</Label>
                  <Input id="quote-follow" type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} />
                </div>
              </div>
              {suggestion ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <span>Tarifario: <strong className="tabular-nums">{formatMoney(suggestion.amount)}</strong></span>
                  <span className="text-xs text-muted-foreground">{suggestion.detail}</span>
                  {amount !== suggestion.amount && (
                    <Button variant="link" size="sm" className="ml-auto h-auto p-0" onClick={() => setAmount(suggestion.amount)}>Usar</Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sin precio de referencia para este destino. Cargalo en el <Link href="/app/crm/tarifario" className="text-primary hover:underline">tarifario</Link>.
                </p>
              )}
              <div className="flex justify-end">
                <Button disabled={pending || !dirty} onClick={() => save()}>Guardar cambios</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Responder al cliente</CardTitle>
              <CardDescription>
                {quote.sentAt ? `Primer envío: ${formatDateTime(quote.sentAt)}` : 'Al enviar, la cotización pasa a “Enviada” y cuenta el tiempo de respuesta.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={12} value={message} onChange={(e) => setMessageEdited(e.target.value)} className="font-mono text-xs" />
              {messageEdited !== null && (
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => setMessageEdited(null)}>Volver al texto automático</button>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={pending} onClick={() => send('whatsapp')}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => send('email')}><Mail className="mr-1 h-4 w-4" />Mail</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => send('copy')}><Copy className="mr-1 h-4 w-4" />Copiar</Button>
              </div>
              {!contact && <p className="text-xs text-muted-foreground">Elegí un contacto para abrir WhatsApp o el mail directo.</p>}
            </CardContent>
          </Card>

          {request?.message && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Mensaje original</CardTitle></CardHeader>
              <CardContent>
                {request.subject && <p className="mb-1 text-sm font-medium">{request.subject}</p>}
                <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm">{request.message}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Historial</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={note} placeholder="Agregar nota (ej.: llamé, pide bajar 5%)" onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) run(() => addQuoteNote(quote.id, note), () => setNote('')) }} />
                <Button size="icon" variant="outline" disabled={pending || !note.trim()} onClick={() => run(() => addQuoteNote(quote.id, note), () => setNote(''))} aria-label="Agregar nota"><Send className="h-4 w-4" /></Button>
              </div>
              <ol className="space-y-2 border-l pl-4">
                {events.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/50" />
                    <p>{describeEvent(e)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}{e.createdByName ? ` · ${e.createdByName}` : ''}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      <StageDialog
        request={stageReq}
        onCancel={() => setStageReq(null)}
        onConfirm={(extra) => {
          if (stageReq) {
            const { stage } = stageReq
            if (extra.quotedAmount) setAmount(extra.quotedAmount)
            run(() => moveQuote({ id: quote.id, stage, position: quote.position, quotedAmount: extra.quotedAmount ?? amount ?? null, lostReason: extra.lostReason ?? null, lostNotes: extra.lostNotes ?? null }))
          }
          setStageReq(null)
        }}
      />
    </div>
  )
}

function describeEvent(e: CrmQuoteEvent): string {
  switch (e.kind) {
    case 'created': return `Entró al board${e.body ? ` · ${e.body}` : ''}`
    case 'stage': return `${e.fromStage ? STAGE_LABELS[e.fromStage] : '—'} → ${e.toStage ? STAGE_LABELS[e.toStage] : '—'}${e.body ? ` · ${e.body}` : ''}`
    case 'amount': {
      const from = e.metadata.from as number | null
      const to = e.metadata.to as number | null
      return from ? `Precio: ${formatMoney(Number(from))} → ${formatMoney(to == null ? null : Number(to))}` : `Precio: ${formatMoney(to == null ? null : Number(to))}`
    }
    case 'sent': return e.body ?? 'Enviada'
    case 'note': return e.body ?? ''
    default: return e.body ?? 'Actualización'
  }
}

