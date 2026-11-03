'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertTriangle, CheckCircle2, ExternalLink, FileText, Mail, Pause, Play, Plus, RefreshCw, Search, Send, Settings2, Trash2, Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  buildTemplateVars, missingVariables, OUTREACH_STATUS_LABELS, PRIORITY_LABELS, PROSPECT_STATUS_LABELS, renderTemplate,
  type OutreachRoute, type ProspectPriority, type ProspectStatus,
} from '@/lib/crm/prospecting'
import {
  deleteProspects, disconnectGmail, importProspects, setProspectsStatus, setSequencesPaused, startSequence, syncOutreachNow,
  updateGmailSettings, upsertProspect,
} from '@/lib/crm/server/actions-prospects'
import type { GmailConnectionInfo, ProspectRow, ProspectsPageData } from '@/lib/crm/server/data-prospects'
import { formatDate, formatDateTime, useAction } from './shared'

const STATUS_STYLES: Record<ProspectStatus, string> = {
  nuevo: 'bg-muted text-muted-foreground',
  en_secuencia: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
  respondio: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  cotizando: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200',
  ganado: 'bg-green-600 text-white',
  perdido: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  sin_respuesta: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  baja: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
  rebotado: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
}

const PRIORITY_STYLES: Record<ProspectPriority, string> = {
  alta: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300',
  media: 'text-muted-foreground',
  baja: 'text-muted-foreground/70',
}

const ALL = '__all'
const STATUS_ORDER: ProspectStatus[] = ['nuevo', 'en_secuencia', 'respondio', 'cotizando', 'ganado', 'sin_respuesta', 'perdido', 'baja', 'rebotado']

function StatusBadge({ status }: { status: ProspectStatus }) {
  return <span className={cn('whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium', STATUS_STYLES[status])}>{PROSPECT_STATUS_LABELS[status]}</span>
}

type Props = { data: ProspectsPageData; flash: { ok: boolean; msg: string } | null }

export function ProspectsView({ data, flash }: Props) {
  const router = useRouter()
  const { pending, run } = useAction()
  const [q, setQ] = useState('')
  const [route, setRoute] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [priority, setPriority] = useState(ALL)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<ProspectRow | 'new' | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)

  useEffect(() => {
    if (!flash) return
    if (flash.ok) toast.success(flash.msg)
    else toast.error(flash.msg)
    router.replace('/app/crm/prospectos')
  }, [flash, router])

  const routeLabel = useMemo(() => Object.fromEntries(data.routes.map((r) => [r.key, r.label])), [data.routes])
  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<ProspectStatus, number>
    for (const p of data.prospects) c[p.status]++
    return c
  }, [data.prospects])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.prospects.filter((p) =>
      (route === ALL || (route === '__none' ? !p.routeKey : p.routeKey === route)) &&
      (status === ALL || p.status === status) &&
      (priority === ALL || p.priority === priority) &&
      (!needle || [p.companyName, p.email, p.contactName, p.products, p.city, p.province].some((s) => s?.toLowerCase().includes(needle))),
    )
  }, [data.prospects, q, route, status, priority])

  const selectedRows = data.prospects.filter((p) => selected.has(p.id))
  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allVisibleSelected) filtered.forEach((p) => n.delete(p.id)); else filtered.forEach((p) => n.add(p.id))
    return n
  })
  const ids = [...selected]
  const clear = () => setSelected(new Set())

  return (
    <div className="space-y-4">
      <GmailCard data={data} />

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setStatus(ALL)} className={cn('rounded-full border px-3 py-1 text-xs', status === ALL && 'border-primary bg-primary/10 font-medium')}>
          Todos <span className="tabular-nums text-muted-foreground">{data.prospects.length}</span>
        </button>
        {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(status === s ? ALL : s)} className={cn('rounded-full border px-3 py-1 text-xs', status === s && 'border-primary bg-primary/10 font-medium')}>
            {PROSPECT_STATUS_LABELS[s]} <span className="tabular-nums text-muted-foreground">{counts[s]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Empresa, mail, producto, localidad" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={route} onValueChange={setRoute}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Ruta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las rutas</SelectItem>
            {data.routes.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
            <SelectItem value="__none">Sin ruta</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toda prioridad</SelectItem>
            {(['alta', 'media', 'baja'] as const).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href="/app/crm/prospectos/plantillas"><FileText className="mr-1 h-4 w-4" />Plantillas</Link></Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-1 h-4 w-4" />Importar CSV</Button>
          <Button onClick={() => setEditing('new')}><Plus className="mr-1 h-4 w-4" />Nuevo prospecto</Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-2 shadow-sm backdrop-blur">
          <span className="px-2 text-sm font-medium">{selected.size} seleccionados</span>
          <Button size="sm" onClick={() => setSendOpen(true)}><Send className="mr-1 h-4 w-4" />Enviar mail de vuelta</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setSequencesPaused(ids, true))}><Pause className="mr-1 h-4 w-4" />Pausar</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setSequencesPaused(ids, false))}><Play className="mr-1 h-4 w-4" />Reanudar</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline">Marcar como…</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_ORDER.map((s) => (
                <DropdownMenuItem key={s} onClick={() => run(() => setProspectsStatus(ids, s))}>{PROSPECT_STATUS_LABELS[s]}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" className="text-destructive" disabled={pending}
            onClick={() => { if (confirm(`¿Eliminar ${selected.size} prospectos?`)) run(() => deleteProspects(ids), clear) }}>
            <Trash2 className="mr-1 h-4 w-4" />Eliminar
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={clear}>Quitar selección</Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"><Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Seleccionar todos" /></TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="hidden md:table-cell">Ruta</TableHead>
                <TableHead className="hidden lg:table-cell">Productos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden sm:table-cell">Último contacto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" data-state={selected.has(p.id) ? 'selected' : undefined} onClick={() => setEditing(p)}>
                  <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={`Seleccionar ${p.companyName}`} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{p.companyName}</span>
                      <Badge variant="outline" className={cn('px-1 py-0 text-[10px] font-normal', PRIORITY_STYLES[p.priority])}>{PRIORITY_LABELS[p.priority]}</Badge>
                      {p.companyId && <Badge variant="secondary" className="px-1 py-0 text-[10px] font-normal" title="Ya está en Empresas del CRM">Conocida</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[p.contactName, p.email ?? 'sin mail'].filter(Boolean).join(' · ')}
                      {p.suppressed && <span className="ml-1 text-rose-600">(no contactar)</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {p.routeKey ? routeLabel[p.routeKey] : <span className="text-muted-foreground">—</span>}
                    <div className="text-xs text-muted-foreground">{[p.city, p.province].filter(Boolean).join(', ')}</div>
                  </TableCell>
                  <TableCell className="hidden max-w-56 truncate text-xs text-muted-foreground lg:table-cell">{p.products ?? '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                    <SequenceLine p={p} />
                  </TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">{formatDate(p.lastContactedAt)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {data.prospects.length ? 'No hay prospectos con ese filtro.' : 'Todavía no hay prospectos: importá el CSV o cargá uno a mano.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && <ProspectDialog prospect={editing === 'new' ? null : editing} routes={data.routes} onClose={() => setEditing(null)} />}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      {sendOpen && <SendDialog rows={selectedRows} data={data} onClose={() => setSendOpen(false)} onDone={clear} />}
    </div>
  )
}

function SequenceLine({ p }: { p: ProspectRow }) {
  const o = p.outreach
  if (!o) return null
  const total = 4
  const sent = o.messages.filter((m) => m.status === 'sent').length
  let text = `${OUTREACH_STATUS_LABELS[o.status]} · ${sent}/${total} enviados`
  if (o.status === 'activa' && o.nextSendAt) text += ` · próximo ${formatDate(o.nextSendAt)}`
  return (
    <div className={cn('mt-0.5 text-xs', o.status === 'error' ? 'text-destructive' : 'text-muted-foreground')} title={o.error ?? undefined}>
      {text}
      {o.inboundRequestId && <Link href="/app/crm/bandeja" className="ml-1 underline" onClick={(e) => e.stopPropagation()}>ver pedido</Link>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Casilla de Gmail
// ---------------------------------------------------------------------------

function GmailCard({ data }: { data: ProspectsPageData }) {
  const { pending, run } = useAction()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const c = data.connection
  if (!c) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" />Conectá la casilla de Gmail</CardTitle>
          <CardDescription>
            Los mails salen desde esa casilla (quedan en Enviados) y las respuestas entran solas a la Bandeja de entrada como pedidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data.gmail.configured && (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Faltan variables de entorno: {data.gmail.missing.join(', ')}. Ver docs/CRM.md, sección Prospección.
            </p>
          )}
          <Button asChild disabled={!data.gmail.configured}>
            <a href="/api/crm/gmail/connect"><Mail className="mr-1 h-4 w-4" />Conectar Gmail</a>
          </Button>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <div className="text-sm font-medium">{c.email}</div>
            <div className="text-xs text-muted-foreground">
              Envía {c.weekdaysOnly ? 'lun a vie' : 'todos los días'} de {c.sendHourFrom} a {c.sendHourTo} h · hasta {c.dailyLimit} por día
            </div>
          </div>
        </div>
        <div className="text-sm">
          <span className="font-semibold tabular-nums">{data.sentToday}</span><span className="text-muted-foreground">/{c.dailyLimit} enviados hoy</span>
          <span className="mx-2 text-muted-foreground">·</span>
          <span className="font-semibold tabular-nums">{data.dueNow}</span><span className="text-muted-foreground"> en cola</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Última sincronización: {c.lastSyncAt ? formatDateTime(c.lastSyncAt) : 'nunca'}
          {c.lastError && <div className="text-destructive">{c.lastError}</div>}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={pending} onClick={() => run(syncOutreachNow)}>
            <RefreshCw className={cn('mr-1 h-4 w-4', pending && 'animate-spin')} />Sincronizar ahora
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Ajustes de envío"><Settings2 className="h-4 w-4" /></Button>
        </div>
      </CardContent>
      {settingsOpen && <SettingsDialog conn={c} onClose={() => setSettingsOpen(false)} />}
    </Card>
  )
}

function SettingsDialog({ conn, onClose }: { conn: GmailConnectionInfo; onClose: () => void }) {
  const { pending, run } = useAction()
  const [f, setF] = useState({
    senderName: conn.senderName, signature: conn.signature, dailyLimit: String(conn.dailyLimit),
    sendHourFrom: String(conn.sendHourFrom), sendHourTo: String(conn.sendHourTo), weekdaysOnly: conn.weekdaysOnly,
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustes de envío</DialogTitle>
          <DialogDescription>Casilla {conn.email}. Para no caer en spam, arrancá con 20–30 por día.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nombre del remitente</Label><Input value={f.senderName} onChange={(e) => setF({ ...f, senderName: e.target.value })} /></div>
          <div className="space-y-1"><Label>Firma</Label><Textarea rows={3} value={f.signature} onChange={(e) => setF({ ...f, signature: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1"><Label>Por día</Label><Input type="number" min={1} max={200} value={f.dailyLimit} onChange={(e) => setF({ ...f, dailyLimit: e.target.value })} /></div>
            <div className="space-y-1"><Label>Desde (h)</Label><Input type="number" min={0} max={23} value={f.sendHourFrom} onChange={(e) => setF({ ...f, sendHourFrom: e.target.value })} /></div>
            <div className="space-y-1"><Label>Hasta (h)</Label><Input type="number" min={1} max={24} value={f.sendHourTo} onChange={(e) => setF({ ...f, sendHourTo: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.weekdaysOnly} onCheckedChange={(v) => setF({ ...f, weekdaysOnly: v })} />Sólo de lunes a viernes</label>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" className="text-destructive" disabled={pending}
            onClick={() => { if (confirm('¿Desconectar Gmail? Las secuencias quedan pausadas.')) run(disconnectGmail, onClose) }}>Desconectar</Button>
          <Button disabled={pending} onClick={() => run(() => updateGmailSettings({
            senderName: f.senderName, signature: f.signature, dailyLimit: Number(f.dailyLimit),
            sendHourFrom: Number(f.sendHourFrom), sendHourTo: Number(f.sendHourTo), weekdaysOnly: f.weekdaysOnly,
          }), onClose)}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Enviar (vista previa + confirmar)
// ---------------------------------------------------------------------------

function SendDialog({ rows, data, onClose, onDone }: { rows: ProspectRow[]; data: ProspectsPageData; onClose: () => void; onDone: () => void }) {
  const { pending, run } = useAction()
  const eligible = rows.filter((p) => p.email && !p.suppressed && !['baja', 'rebotado', 'ganado'].includes(p.status) && !(p.outreach && ['activa', 'pausada'].includes(p.outreach.status)))
  const [i, setI] = useState(0)
  const p = eligible[Math.min(i, eligible.length - 1)]
  const first = data.templates.find((t) => t.sequence === 'vuelta' && t.step === 1)
  const followups = data.templates.filter((t) => t.sequence === 'vuelta' && t.step > 1 && t.isActive)
  const signature = data.connection?.signature ?? 'Rosario Perez\nTransporte Rosario Perez\nWhatsApp 3329 64-3639'
  const route = p ? data.routes.find((r) => r.key === p.routeKey) ?? null : null
  const vars = p ? buildTemplateVars(p, route, signature) : null
  const missing = vars && first ? missingVariables(`${first.subject}\n${first.body}`, vars) : []
  const limit = data.connection?.dailyLimit ?? 25
  const days = Math.ceil(eligible.length / limit)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar mail de vuelta</DialogTitle>
          <DialogDescription>
            {eligible.length} de {rows.length} seleccionados entran en la secuencia
            {rows.length > eligible.length && ' (el resto no tiene mail, pidió baja, rebotó, está ganado o ya está en secuencia)'}.
            Salen hasta {limit} por día{days > 1 ? `, así que tarda unos ${days} días hábiles` : ''}. Si responden, la secuencia se corta y el pedido entra a la Bandeja.
          </DialogDescription>
        </DialogHeader>

        {!data.connection && (
          <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Gmail no está conectado: quedan en cola y salen cuando lo conectes.
          </p>
        )}

        {p && first && vars ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Vista previa para</span>
              <span className="font-medium">{p.companyName}</span>
              <span className="text-muted-foreground">({p.email})</span>
              {eligible.length > 1 && (
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>‹</Button>
                  <span className="self-center text-xs tabular-nums text-muted-foreground">{i + 1}/{eligible.length}</span>
                  <Button size="sm" variant="ghost" disabled={i >= eligible.length - 1} onClick={() => setI(i + 1)}>›</Button>
                </div>
              )}
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="mb-2 border-b pb-2"><span className="text-muted-foreground">Asunto: </span><span className="font-medium">{renderTemplate(first.subject, vars)}</span></div>
              <pre className="whitespace-pre-wrap font-sans">{renderTemplate(first.body, vars)}</pre>
            </div>
            {missing.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-300">Faltan datos para este prospecto: {missing.join(', ')}. Completalos o el mail sale con el texto genérico.</p>
            )}
            {!p.hook && <p className="text-xs text-muted-foreground">Tip: una línea personalizada (“gancho”) en el prospecto sube mucho las respuestas.</p>}
            <p className="text-xs text-muted-foreground">
              Después, si no responde: {followups.map((t) => `día ${t.delayDays}`).join(', ') || 'sin seguimientos'} (en el mismo hilo).{' '}
              <Link href="/app/crm/prospectos/plantillas" className="underline">Editar plantillas</Link>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay prospectos que puedan entrar en la secuencia.</p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={pending || eligible.length === 0} onClick={() => run(() => startSequence(eligible.map((x) => x.id)), () => { onDone(); onClose() })}>
            <Send className="mr-1 h-4 w-4" />Poner {eligible.length} en cola
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Alta / edición
// ---------------------------------------------------------------------------

function ProspectDialog({ prospect, routes, onClose }: { prospect: ProspectRow | null; routes: OutreachRoute[]; onClose: () => void }) {
  const { pending, run } = useAction()
  const p = prospect
  const [f, setF] = useState({
    companyName: p?.companyName ?? '', routeKey: p?.routeKey ?? '', province: p?.province ?? '', city: p?.city ?? '',
    products: p?.products ?? '', contactName: p?.contactName ?? '', contactRole: p?.contactRole ?? '', email: p?.email ?? '',
    phone: p?.phone ?? '', website: p?.website ?? '', priority: (p?.priority ?? 'media') as ProspectPriority, hook: p?.hook ?? '',
    source: p?.source ?? '', sourceUrl: p?.sourceUrl ?? '', notes: p?.notes ?? '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const n = (v: string) => v.trim() || null
  const save = () => run(() => upsertProspect({
    id: p?.id,
    companyName: f.companyName.trim(),
    routeKey: f.routeKey || null,
    province: n(f.province), city: n(f.city), products: n(f.products),
    contactName: n(f.contactName), contactRole: n(f.contactRole), email: n(f.email), phone: n(f.phone),
    website: n(f.website), priority: f.priority, hook: n(f.hook), source: n(f.source), sourceUrl: n(f.sourceUrl), notes: n(f.notes),
  }), onClose)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{p ? p.companyName : 'Nuevo prospecto'}</DialogTitle>
          {p && (
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <StatusBadge status={p.status} />
              {p.suppressed && <span className="text-rose-600">No contactar ({p.suppressed})</span>}
              {p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Fuente <ExternalLink className="h-3 w-3" /></a>}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>Empresa</Label><Input value={f.companyName} onChange={set('companyName')} /></div>
          <div className="space-y-1"><Label>Mail</Label><Input type="email" value={f.email} onChange={set('email')} /></div>
          <div className="space-y-1"><Label>Teléfono</Label><Input value={f.phone} onChange={set('phone')} /></div>
          <div className="space-y-1"><Label>Contacto</Label><Input value={f.contactName} onChange={set('contactName')} /></div>
          <div className="space-y-1"><Label>Cargo</Label><Input value={f.contactRole} onChange={set('contactRole')} /></div>
          <div className="space-y-1">
            <Label>Ruta de vuelta</Label>
            <Select value={f.routeKey || '__none'} onValueChange={(v) => setF({ ...f, routeKey: v === '__none' ? '' : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sin ruta</SelectItem>
                {routes.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Prioridad</Label>
            <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as ProspectPriority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['alta', 'media', 'baja'] as const).map((x) => <SelectItem key={x} value={x}>{PRIORITY_LABELS[x]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Provincia</Label><Input value={f.province} onChange={set('province')} /></div>
          <div className="space-y-1"><Label>Localidad</Label><Input value={f.city} onChange={set('city')} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Productos</Label><Input placeholder="peras y manzanas" value={f.products} onChange={set('products')} /></div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Gancho (línea personalizada del primer mail)</Label>
            <Textarea rows={2} placeholder="Vi que venden en el Mercado Central de Buenos Aires." value={f.hook} onChange={set('hook')} />
          </div>
          <div className="space-y-1"><Label>Web</Label><Input value={f.website} onChange={set('website')} /></div>
          <div className="space-y-1"><Label>Fuente</Label><Input value={f.source} onChange={set('source')} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Notas</Label><Textarea rows={3} value={f.notes} onChange={set('notes')} /></div>
        </div>

        {p?.outreach && p.outreach.messages.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Mails de la secuencia</div>
            {p.outreach.messages.map((m, idx) => (
              <details key={idx} className="rounded-md border p-2 text-sm">
                <summary className="cursor-pointer">
                  Mail {m.step} · {formatDateTime(m.sentAt)} · {m.status === 'sent' ? 'enviado' : <span className="text-destructive">falló: {m.error}</span>}
                </summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground">{m.body}</pre>
              </details>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={pending || !f.companyName.trim()} onClick={save}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Importar CSV
// ---------------------------------------------------------------------------

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pending, run } = useAction()
  const [text, setText] = useState('')
  const onFile = async (file: File | undefined) => {
    if (!file) return
    setText(await file.text())
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar prospectos</DialogTitle>
          <DialogDescription>
            CSV con encabezado. Columnas que reconoce: empresa (obligatoria), mail, contacto, cargo, teléfono, web, provincia,
            localidad, ruta, productos, prioridad, gancho, fuente, url fuente, notas. Los mails repetidos se saltean.
          </DialogDescription>
        </DialogHeader>
        <Input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
        <Textarea rows={10} className="font-mono text-xs" placeholder={'empresa,mail,contacto,provincia,localidad,productos,prioridad\nKleppe S.A.,jpcerezuela@kleppe.com.ar,Juan Pablo Cerezuela,Río Negro,Cipolletti,Peras y manzanas,alta'}
          value={text} onChange={(e) => setText(e.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={pending || !text.trim()} onClick={() => run(() => importProspects(text), () => { setText(''); onOpenChange(false) })}>
            <Upload className="mr-1 h-4 w-4" />Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
