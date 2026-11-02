'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Inbox, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DISCARD_REASONS } from '@/lib/crm/constants'
import { describeReason, STRONG_MATCH } from '@/lib/crm/matching'
import { normalizeCompanyName } from '@/lib/crm/normalize'
import { acceptRequest, discardRequest, reopenRequest } from '@/lib/crm/server/actions-inbox'
import type { PendingRequest } from '@/lib/crm/server/data'
import type { CrmInboundRequest } from '@/lib/crm/types'
import { cn } from '@/lib/utils'
import type { CompanyOption } from './company-picker'
import { CompanyPicker } from './company-picker'
import { NewRequestDialog } from './new-request-dialog'
import { QuoteFields, type QuoteFieldsValue } from './quote-fields'
import { ago, ChannelBadge, formatDateTime, isSameDayLate, useAction } from './shared'

type Props = {
  pending: PendingRequest[]
  recent: CrmInboundRequest[]
  companies: CompanyOption[]
  companyNames: Record<string, string>
}

export function InboxView({ pending, recent, companies, companyNames }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cada pedido se revisa acá antes de entrar al board: confirmás a qué empresa corresponde (o la creás) y corregís los datos.
        </p>
        <NewRequestDialog />
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No hay pedidos para revisar</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Los pedidos de la web entran solos. Los de WhatsApp y mail se cargan con “Cargar pedido”, pegando el mensaje.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((r) => (
            <TriageCard key={r.id} request={r} companies={companies} companyNames={companyNames} />
          ))}
        </div>
      )}

      {recent.length > 0 && <RecentList recent={recent} companyNames={companyNames} />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function TriageCard({ request: r, companies, companyNames }: { request: PendingRequest; companies: CompanyOption[]; companyNames: Record<string, string> }) {
  const written = r.companyNameRaw ?? r.parsed.companyName ?? ''
  const top = r.candidates[0]
  const [choice, setChoice] = useState<string | 'new' | null>(
    top && top.score >= STRONG_MATCH ? top.companyId : r.candidates.length === 0 ? 'new' : null,
  )
  const [otherId, setOtherId] = useState<string | null>(null)
  const [newName, setNewName] = useState(written)
  const [newCuit, setNewCuit] = useState(r.cuitRaw ?? r.parsed.cuit ?? '')
  const [saveAlias, setSaveAlias] = useState(true)
  const [contact, setContact] = useState({
    name: r.senderName ?? r.parsed.senderName ?? '',
    email: r.senderEmail ?? r.parsed.emails?.[0] ?? '',
    phone: r.senderPhone ?? r.parsed.phones?.[0] ?? '',
  })
  const [fields, setFields] = useState<QuoteFieldsValue>({
    origin: r.parsed.origin ?? '',
    destination: r.parsed.destination ?? '',
    serviceType: r.parsed.serviceType ?? null,
    loadType: r.parsed.loadType ?? null,
    pallets: r.parsed.pallets ?? null,
    weightKg: r.parsed.weightKg ?? null,
    loadDate: r.parsed.loadDate ?? null,
    frequency: r.parsed.frequency ?? null,
  })
  const [expanded, setExpanded] = useState(false)
  const { pending, run } = useAction()

  const companyId = choice === 'other' ? otherId : choice !== 'new' ? choice : null
  const chosenName = companyId ? companyNames[companyId] : null
  const aliasWouldSave =
    !!written && !!chosenName && normalizeCompanyName(written) !== normalizeCompanyName(chosenName)
  const late = isSameDayLate(r.receivedAt)
  const message = r.message ?? ''
  const long = message.length > 420

  const accept = () =>
    run(() =>
      acceptRequest({
        requestId: r.id,
        companyId,
        newCompany: choice === 'new' ? { name: newName, cuit: newCuit || null } : null,
        saveAlias: saveAlias && aliasWouldSave,
        contact: { name: contact.name || null, email: contact.email || null, phone: contact.phone || null },
        quote: {
          ...fields,
          origin: fields.origin || null,
          destination: fields.destination || null,
          description: null,
        },
      }),
    )

  return (
    <Card className={cn(late && 'border-amber-300 dark:border-amber-800')}>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0 pb-3">
        <ChannelBadge channel={r.channel} />
        <CardTitle className="text-base">{written || contact.name || contact.email || contact.phone || 'Pedido sin datos'}</CardTitle>
        <span className={cn('text-xs', late ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground')} title={formatDateTime(r.receivedAt)}>
          {ago(r.receivedAt)}{late && ' · responder hoy'}
        </span>
        {r.possibleDuplicateOf && (
          <Badge variant="outline" className="gap-1 border-amber-300 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" />Posible duplicado
          </Badge>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* Mensaje original */}
        <div className="space-y-3">
          {r.subject && <p className="text-sm font-medium">{r.subject}</p>}
          {message ? (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className={cn('whitespace-pre-wrap break-words', !expanded && long && 'line-clamp-[10]')}>{message}</p>
              {long && (
                <button type="button" className="mt-1 text-xs text-primary hover:underline" onClick={() => setExpanded((x) => !x)}>
                  {expanded ? 'Ver menos' : 'Ver todo'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin mensaje.</p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="space-y-1"><Label className="text-xs">Contacto</Label><Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Mail</Label><Input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Teléfono</Label><Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
          </div>
        </div>

        {/* Decisión */}
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-1 flex items-center gap-1.5 text-sm font-medium">
              <Building2 className="h-4 w-4" />¿Qué empresa es?
              {written && <span className="font-normal text-muted-foreground">Escribió “{written}”</span>}
            </legend>
            {r.candidates.map((c) => (
              <OptionRow key={c.companyId} checked={choice === c.companyId} onSelect={() => setChoice(c.companyId)}>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{c.companyName}</span>
                  {c.reasons.map((reason, i) => (
                    <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{describeReason(reason)}</span>
                  ))}
                </div>
                <ScorePill score={c.score} />
              </OptionRow>
            ))}
            <OptionRow checked={choice === 'other'} onSelect={() => setChoice('other')}>
              <div className="flex-1 space-y-2">
                <span className="text-sm">Otra empresa existente</span>
                {choice === 'other' && <CompanyPicker companies={companies} value={otherId} onChange={setOtherId} />}
              </div>
            </OptionRow>
            <OptionRow checked={choice === 'new'} onSelect={() => setChoice('new')}>
              <div className="flex-1 space-y-2">
                <span className="flex items-center gap-1 text-sm"><Sparkles className="h-3.5 w-3.5 text-primary" />Empresa nueva</span>
                {choice === 'new' && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                    <Input value={newName} placeholder="Nombre de la empresa" onChange={(e) => setNewName(e.target.value)} />
                    <Input value={newCuit} placeholder="CUIT (opcional)" onChange={(e) => setNewCuit(e.target.value)} />
                  </div>
                )}
              </div>
            </OptionRow>
            {aliasWouldSave && (
              <label className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                <Checkbox checked={saveAlias} onCheckedChange={(v) => setSaveAlias(v === true)} />
                Recordar “{written}” como otra forma de escribir {chosenName}
              </label>
            )}
          </fieldset>

          <div className="space-y-2">
            <p className="text-sm font-medium">Pedido</p>
            <QuoteFields idPrefix={r.id} value={fields} onChange={setFields} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" disabled={pending}><Trash2 className="mr-1 h-4 w-4" />Descartar</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Motivo</DropdownMenuLabel>
                {DISCARD_REASONS.map((reason) => (
                  <DropdownMenuItem key={reason} onSelect={() => run(() => discardRequest(r.id, reason))}>{reason}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button disabled={pending || (!companyId && choice !== 'new') || (choice === 'new' && !newName.trim())} onClick={accept}>
              Pasar al board<ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OptionRow({ checked, onSelect, children }: { checked: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onSelect() } }}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition-colors',
        checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
      )}
    >
      <span className={cn('mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', checked && 'border-primary')}>
        {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      {children}
    </div>
  )
}

function ScorePill({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const strong = score >= STRONG_MATCH
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        strong ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
      )}
      title={strong ? 'Coincidencia fuerte' : 'Posible: revisá antes de confirmar'}
    >
      {pct}%
    </span>
  )
}

// ---------------------------------------------------------------------------

function RecentList({ recent, companyNames }: { recent: CrmInboundRequest[]; companyNames: Record<string, string> }) {
  const { pending, run } = useAction()
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Procesados en los últimos 14 días</CardTitle></CardHeader>
      <CardContent className="divide-y p-0">
        {recent.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 px-6 py-2 text-sm">
            <ChannelBadge channel={r.channel} compact />
            <span className="min-w-0 flex-1 truncate">
              {r.companyId ? companyNames[r.companyId] ?? '—' : r.companyNameRaw ?? r.senderName ?? r.senderEmail ?? r.senderPhone ?? 'Sin datos'}
              <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(r.receivedAt)}</span>
            </span>
            {r.status === 'accepted' ? (
              r.quoteId ? (
                <Link href={`/app/crm/cotizaciones/${r.quoteId}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <CheckCircle2 className="h-3.5 w-3.5" />Ver cotización
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">Aceptado</span>
              )
            ) : (
              <>
                <span className="text-xs text-muted-foreground">Descartado · {r.discardReason ?? 'sin motivo'}</span>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => reopenRequest(r.id))}>
                  <Undo2 className="mr-1 h-3.5 w-3.5" />Volver a la bandeja
                </Button>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
