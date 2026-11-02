'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Mail, MessageCircle, Phone, CircleDot } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CHANNEL_LABELS, SERVICE_LABELS } from '@/lib/crm/constants'
import type { CrmChannel, CrmServiceType } from '@/lib/crm/types'

type ActionResult = { error?: string; success?: string }

export function useAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const run = <T extends ActionResult>(fn: () => Promise<T>, onOk?: (r: T) => void) =>
    startTransition(async () => {
      const r = await fn()
      if (r.error) toast.error(r.error)
      else {
        if (r.success) toast.success(r.success)
        onOk?.(r)
        router.refresh()
      }
    })
  return { pending, run }
}

const CHANNEL_ICONS: Record<CrmChannel, typeof Mail> = {
  whatsapp: MessageCircle,
  email: Mail,
  landing: Globe,
  phone: Phone,
  other: CircleDot,
}

const CHANNEL_STYLES: Record<CrmChannel, string> = {
  whatsapp: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  email: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  landing: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
  phone: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  other: 'bg-muted text-muted-foreground',
}

export function ChannelBadge({ channel, compact = false }: { channel: CrmChannel; compact?: boolean }) {
  const Icon = CHANNEL_ICONS[channel]
  return (
    <Badge variant="outline" className={cn('gap-1 font-normal', CHANNEL_STYLES[channel])} title={CHANNEL_LABELS[channel]}>
      <Icon className="h-3 w-3" />
      {!compact && CHANNEL_LABELS[channel]}
    </Badge>
  )
}

const SERVICE_STYLES: Record<CrmServiceType, string> = {
  congelado: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  refrigerado: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200',
  controlada: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200',
  seco: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200',
}

export function ServiceBadge({ service }: { service: CrmServiceType | null }) {
  if (!service) return null
  return <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', SERVICE_STYLES[service])}>{SERVICE_LABELS[service]}</span>
}

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
export function formatMoney(n: number | null | undefined): string {
  return n == null ? '—' : money.format(n)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** "hace 3 h", "hace 2 d" */
export function ago(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `hace ${mins} min`
  const h = Math.round(mins / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** El compromiso es responder cotizaciones en el día (hasta las 21 h). */
export function isSameDayLate(receivedAt: string, now = new Date()): boolean {
  const r = new Date(receivedAt)
  const sameDay = r.toDateString() === now.toDateString()
  return !sameDay || now.getHours() >= 21
}
