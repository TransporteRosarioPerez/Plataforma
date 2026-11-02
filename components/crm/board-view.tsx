'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, MoreHorizontal, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CHANNEL_LABELS, SERVICE_LABELS, STAGE_HINTS, STAGE_LABELS, STAGES } from '@/lib/crm/constants'
import { quoteCode } from '@/lib/crm/quote-message'
import { moveQuote } from '@/lib/crm/server/actions-quotes'
import type { CrmChannel, CrmQuote, CrmServiceType, CrmStage } from '@/lib/crm/types'
import { cn } from '@/lib/utils'
import { ago, ChannelBadge, formatDate, formatMoney, isSameDayLate, ServiceBadge, todayIso } from './shared'
import { needsExtra, StageDialog, type StageRequest } from './stage-dialogs'

const ALL = '__all'

const STAGE_ACCENT: Record<CrmStage, string> = {
  nuevo: 'bg-slate-400',
  cotizando: 'bg-amber-400',
  enviada: 'bg-sky-500',
  negociacion: 'bg-violet-500',
  ganada: 'bg-emerald-500',
  perdida: 'bg-rose-400',
}

export function BoardView({ quotes: initial }: { quotes: CrmQuote[] }) {
  const router = useRouter()
  const [quotes, setQuotes] = useState(initial)
  const [q, setQ] = useState('')
  const [channel, setChannel] = useState<CrmChannel | typeof ALL>(ALL)
  const [service, setService] = useState<CrmServiceType | typeof ALL>(ALL)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<CrmStage | null>(null)
  const [stageReq, setStageReq] = useState<StageRequest>(null)
  const [, startTransition] = useTransition()

  useEffect(() => setQuotes(initial), [initial])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return quotes.filter((x) => {
      if (channel !== ALL && x.channel !== channel) return false
      if (service !== ALL && x.serviceType !== service) return false
      if (!needle) return true
      return [x.companyName, x.destination, x.origin, x.contactName, quoteCode(x.number)].some((s) => s?.toLowerCase().includes(needle))
    })
  }, [quotes, q, channel, service])

  const byStage = useMemo(() => {
    const m = new Map<CrmStage, CrmQuote[]>(STAGES.map((s) => [s, []]))
    for (const x of visible) m.get(x.stage)!.push(x)
    for (const list of m.values()) list.sort((a, b) => a.position - b.position)
    return m
  }, [visible])

  /** Posición entre vecinos: antes de `beforeId`, o al final de la columna. */
  const positionFor = (stage: CrmStage, beforeId: string | null, movingId: string): number => {
    const list = quotes.filter((x) => x.stage === stage && x.id !== movingId).sort((a, b) => a.position - b.position)
    if (!list.length) return 0
    if (!beforeId) return list[list.length - 1].position + 1
    const idx = list.findIndex((x) => x.id === beforeId)
    if (idx <= 0) return list[0].position - 1
    return (list[idx - 1].position + list[idx].position) / 2
  }

  const commit = (quote: CrmQuote, stage: CrmStage, position: number, extra: { quotedAmount?: number; lostReason?: string; lostNotes?: string } = {}) => {
    const prev = quotes
    setQuotes((qs) =>
      qs.map((x) => (x.id === quote.id ? { ...x, stage, position, quotedAmount: extra.quotedAmount ?? x.quotedAmount, lostReason: extra.lostReason ?? x.lostReason } : x)),
    )
    startTransition(async () => {
      const r = await moveQuote({ id: quote.id, stage, position, quotedAmount: extra.quotedAmount ?? null, lostReason: extra.lostReason ?? null, lostNotes: extra.lostNotes ?? null })
      if (r.error) {
        toast.error(r.error)
        setQuotes(prev)
      } else if (stage !== quote.stage) {
        toast.success(r.success)
      }
      router.refresh()
    })
  }

  const requestMove = (quote: CrmQuote, stage: CrmStage, beforeId: string | null) => {
    const position = positionFor(stage, beforeId, quote.id)
    if (needsExtra(quote, stage)) setStageReq({ quote, stage, position })
    else commit(quote, stage, position)
  }

  const onDrop = (stage: CrmStage, beforeId: string | null) => {
    const quote = quotes.find((x) => x.id === dragId)
    setDragId(null)
    setOverStage(null)
    if (!quote || beforeId === quote.id) return
    requestMove(quote, stage, beforeId)
  }

  const openTotal = quotes.filter((x) => x.stage !== 'ganada' && x.stage !== 'perdida').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Empresa, destino, COT-…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={channel} onValueChange={(v) => setChannel(v as CrmChannel | typeof ALL)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los canales</SelectItem>
            {(Object.keys(CHANNEL_LABELS) as CrmChannel[]).map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={service} onValueChange={(v) => setService(v as CrmServiceType | typeof ALL)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los servicios</SelectItem>
            {(Object.keys(SERVICE_LABELS) as CrmServiceType[]).map((s) => <SelectItem key={s} value={s}>{SERVICE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">{openTotal} abiertas · cerradas de los últimos 45 días</span>
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Todavía no hay cotizaciones. Entran desde la{' '}
          <Link href="/app/crm/bandeja" className="text-primary hover:underline">Bandeja de entrada</Link>.
        </div>
      ) : (
        <div className="-mx-6 overflow-x-auto overscroll-x-contain px-6 pb-2 contain-inline-size">
          <div className="flex min-w-max gap-3">
            {STAGES.map((stage) => {
              const list = byStage.get(stage)!
              const total = list.reduce((s, x) => s + (x.quotedAmount ?? 0), 0)
              return (
                <section
                  key={stage}
                  aria-label={STAGE_LABELS[stage]}
                  onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverStage(stage) } }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null) }}
                  onDrop={(e) => { e.preventDefault(); onDrop(stage, null) }}
                  className={cn(
                    'flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40 transition-colors',
                    overStage === stage && 'border-primary bg-primary/5',
                  )}
                >
                  <header className="flex items-center gap-2 px-3 pb-2 pt-3" title={STAGE_HINTS[stage]}>
                    <span className={cn('h-2 w-2 rounded-full', STAGE_ACCENT[stage])} />
                    <h2 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h2>
                    <span className="text-xs text-muted-foreground">{list.length}</span>
                    {total > 0 && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatMoney(total)}</span>}
                  </header>
                  <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-3">
                    {list.map((quote) => (
                      <QuoteCard
                        key={quote.id}
                        quote={quote}
                        dragging={dragId === quote.id}
                        onDragStart={() => setDragId(quote.id)}
                        onDragEnd={() => { setDragId(null); setOverStage(null) }}
                        onDropBefore={() => onDrop(stage, quote.id)}
                        canDrop={!!dragId}
                        onMove={(to) => requestMove(quote, to, null)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}

      <StageDialog
        request={stageReq}
        onCancel={() => setStageReq(null)}
        onConfirm={(extra) => {
          if (stageReq) commit(stageReq.quote, stageReq.stage, stageReq.position, extra)
          setStageReq(null)
        }}
      />
    </div>
  )
}

function QuoteCard({
  quote,
  dragging,
  canDrop,
  onDragStart,
  onDragEnd,
  onDropBefore,
  onMove,
}: {
  quote: CrmQuote
  dragging: boolean
  canDrop: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDropBefore: () => void
  onMove: (stage: CrmStage) => void
}) {
  const [over, setOver] = useState(false)
  const open = quote.stage !== 'ganada' && quote.stage !== 'perdida'
  const unanswered = (quote.stage === 'nuevo' || quote.stage === 'cotizando') && !quote.sentAt && isSameDayLate(quote.receivedAt)
  const today = todayIso()
  const followupDue = open && quote.nextFollowupAt && quote.nextFollowupAt <= today
  const expired = quote.stage === 'enviada' && quote.validUntil && quote.validUntil < today
  const route = [quote.origin, quote.destination].filter(Boolean).join(' → ')

  return (
    <article
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', quote.id); onDragStart() }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { if (canDrop) { e.preventDefault(); e.stopPropagation(); setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); onDropBefore() }}
      className={cn(
        'group relative cursor-grab rounded-md border bg-card p-3 text-sm shadow-sm transition active:cursor-grabbing',
        dragging && 'opacity-40',
        over && 'border-t-2 border-t-primary',
        unanswered && 'border-l-4 border-l-amber-400',
      )}
    >
      <div className="flex items-start gap-2">
        <Link href={`/app/crm/cotizaciones/${quote.id}`} className="min-w-0 flex-1 font-medium leading-snug hover:underline" draggable={false}>
          {quote.companyName}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-6 w-6 opacity-60 group-hover:opacity-100" aria-label="Mover a">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mover a</DropdownMenuLabel>
            {STAGES.filter((s) => s !== quote.stage).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onMove(s)}>{STAGE_LABELS[s]}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {route && <p className="mt-0.5 truncate text-muted-foreground">{route}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ChannelBadge channel={quote.channel} compact />
        <ServiceBadge service={quote.serviceType} />
        {quote.pallets ? <span className="text-xs text-muted-foreground">{quote.pallets} pallets</span> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{quoteCode(quote.number)} · {ago(quote.receivedAt)}</span>
        {quote.quotedAmount ? (
          <span className="font-semibold tabular-nums">{formatMoney(quote.quotedAmount)}</span>
        ) : quote.suggestedAmount ? (
          <span className="tabular-nums text-muted-foreground" title="Sugerido por tarifario">~{formatMoney(quote.suggestedAmount)}</span>
        ) : null}
      </div>
      {(unanswered || followupDue || expired || quote.lostReason) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {unanswered && <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" />Sin responder</span>}
          {followupDue && <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400"><CalendarClock className="h-3 w-3" />Seguimiento {formatDate(quote.nextFollowupAt)}</span>}
          {expired && <span className="text-rose-700 dark:text-rose-400">Validez vencida</span>}
          {quote.stage === 'perdida' && quote.lostReason && <span className="text-muted-foreground">{quote.lostReason}</span>}
        </div>
      )}
    </article>
  )
}
