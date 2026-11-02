'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Merge, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { STAGE_LABELS } from '@/lib/crm/constants'
import { formatCuit } from '@/lib/crm/normalize'
import { quoteCode } from '@/lib/crm/quote-message'
import {
  addAlias, deleteCompany, deleteContact, mergeCompanies, removeAlias, upsertCompany, upsertContact,
} from '@/lib/crm/server/actions-companies'
import type { CrmAlias, CrmCompany, CrmContact, CrmInboundRequest, CrmQuote } from '@/lib/crm/types'
import { CompanyPicker, type CompanyOption } from './company-picker'
import { ChannelBadge, formatDate, formatDateTime, formatMoney, ServiceBadge, useAction } from './shared'

type Props = {
  company: CrmCompany
  aliases: CrmAlias[]
  contacts: CrmContact[]
  quotes: CrmQuote[]
  requests: CrmInboundRequest[]
  companies: CompanyOption[]
}

export function CompanyDetailView({ company, aliases, contacts, quotes, requests, companies }: Props) {
  const router = useRouter()
  const { pending, run } = useAction()
  const [form, setForm] = useState({
    name: company.name,
    cuit: company.cuit ? formatCuit(company.cuit) : '',
    emailDomain: company.emailDomain ?? '',
    website: company.website ?? '',
    industry: company.industry ?? '',
    city: company.city ?? '',
    province: company.province ?? '',
    notes: company.notes ?? '',
  })
  const [alias, setAlias] = useState('')
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const [contactEdit, setContactEdit] = useState<Partial<CrmContact> | null>(null)

  const won = quotes.filter((q) => q.stage === 'ganada')
  const lost = quotes.filter((q) => q.stage === 'perdida')
  const decided = won.length + lost.length
  const field = (k: keyof typeof form, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`co-${k}`} className="text-xs">{label}</Label>
      <Input id={`co-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...props} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/app/crm/empresas"><ArrowLeft className="mr-1 h-4 w-4" />Empresas</Link></Button>
        <h2 className="text-lg font-semibold">{company.name}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pedidos" value={String(requests.length)} />
        <Stat label="Cotizaciones" value={String(quotes.length)} />
        <Stat label="Ganadas" value={decided ? `${won.length} de ${decided} (${Math.round((won.length / decided) * 100)}%)` : String(won.length)} />
        <Stat label="Monto ganado" value={formatMoney(won.reduce((s, q) => s + (q.quotedAmount ?? 0), 0))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Datos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {field('name', 'Nombre')}
              {field('cuit', 'CUIT')}
              {field('emailDomain', 'Dominio de mail', { placeholder: 'empresa.com.ar' })}
              {field('website', 'Web')}
              {field('industry', 'Rubro')}
              {field('city', 'Ciudad')}
              {field('province', 'Provincia')}
            </div>
            <div className="space-y-1">
              <Label htmlFor="co-notes" className="text-xs">Notas</Label>
              <Textarea id="co-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-between gap-2">
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={pending}
                onClick={() => { if (window.confirm(`¿Enviar "${company.name}" a la papelera?`)) run(() => deleteCompany(company.id), () => router.push('/app/crm/empresas')) }}
              >
                <Trash2 className="mr-1 h-4 w-4" />Papelera
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  run(() =>
                    upsertCompany({
                      id: company.id,
                      name: form.name,
                      cuit: form.cuit || null,
                      emailDomain: form.emailDomain || null,
                      website: form.website || null,
                      industry: form.industry || null,
                      city: form.city || null,
                      province: form.province || null,
                      notes: form.notes || null,
                    }),
                  )
                }
              >
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Otras formas en que aparece</CardTitle>
              <CardDescription>Si un pedido llega con alguno de estos nombres, se reconoce como {company.name}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {aliases.map((a) => (
                  <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
                    {a.alias}
                    <button type="button" aria-label={`Quitar ${a.alias}`} className="rounded p-0.5 hover:bg-muted-foreground/20" onClick={() => run(() => removeAlias(a.id))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {aliases.length === 0 && <span className="text-sm text-muted-foreground">Ninguna todavía.</span>}
              </div>
              <div className="flex gap-2">
                <Input value={alias} placeholder="Ej.: Lenevo" onChange={(e) => setAlias(e.target.value)} />
                <Button variant="outline" disabled={pending || !alias.trim()} onClick={() => run(() => addAlias(company.id, alias), () => setAlias(''))}>Agregar</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Merge className="h-4 w-4" />Es la misma que otra empresa</CardTitle>
              <CardDescription>Mueve cotizaciones, pedidos, contactos y alias a la empresa elegida, y esta queda como alias.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1"><CompanyPicker companies={companies} value={mergeTarget} onChange={setMergeTarget} excludeId={company.id} placeholder="Elegir empresa…" /></div>
              <Button
                variant="outline"
                disabled={pending || !mergeTarget}
                onClick={() => {
                  const target = companies.find((c) => c.id === mergeTarget)
                  if (target && window.confirm(`¿Fusionar "${company.name}" dentro de "${target.name}"?`)) {
                    run(() => mergeCompanies(company.id, target.id), () => router.push(`/app/crm/empresas/${target.id}`))
                  }
                }}
              >
                Fusionar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Contactos</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setContactEdit({ companyId: company.id })}><Plus className="mr-1 h-4 w-4" />Contacto</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Teléfono</TableHead><TableHead>Mail</TableHead><TableHead className="hidden sm:table-cell">Puesto</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name ?? '—'}</TableCell>
                  <TableCell>{c.phone ?? '—'}</TableCell>
                  <TableCell>{c.email ?? '—'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{c.role ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setContactEdit(c)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (window.confirm('¿Eliminar el contacto?')) run(() => deleteContact(c.id)) }} aria-label="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {contacts.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Sin contactos.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Cotizaciones</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Recibida</TableHead><TableHead>Recorrido</TableHead><TableHead className="hidden md:table-cell">Servicio</TableHead><TableHead>Etapa</TableHead><TableHead className="text-right">Precio</TableHead></TableRow></TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell><Link href={`/app/crm/cotizaciones/${q.id}`} className="font-medium hover:underline">{quoteCode(q.number)}</Link></TableCell>
                  <TableCell className="whitespace-nowrap"><ChannelBadge channel={q.channel} compact /> {formatDate(q.receivedAt)}</TableCell>
                  <TableCell>{[q.origin, q.destination].filter(Boolean).join(' → ') || '—'}{q.pallets ? <span className="text-xs text-muted-foreground"> · {q.pallets} pallets</span> : null}</TableCell>
                  <TableCell className="hidden md:table-cell"><ServiceBadge service={q.serviceType} /></TableCell>
                  <TableCell>{STAGE_LABELS[q.stage]}{q.lostReason ? <span className="text-xs text-muted-foreground"> · {q.lostReason}</span> : null}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(q.quotedAmount)}</TableCell>
                </TableRow>
              ))}
              {quotes.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Sin cotizaciones.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {requests.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Pedidos recibidos</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {requests.map((r) => (
              <div key={r.id} className="flex items-start gap-2 px-6 py-2 text-sm">
                <ChannelBadge channel={r.channel} compact />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{formatDateTime(r.receivedAt)} · escribió “{r.companyNameRaw ?? '—'}”{r.senderName ? ` · ${r.senderName}` : ''}</p>
                  {r.message && <p className="line-clamp-2 whitespace-pre-wrap">{r.message}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ContactDialog value={contactEdit} onClose={() => setContactEdit(null)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function ContactDialog({ value, onClose }: { value: Partial<CrmContact> | null; onClose: () => void }) {
  const { pending, run } = useAction()
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: '' })
  const [lastId, setLastId] = useState<string | undefined | null>(null)
  if (value && value.id !== lastId) {
    setLastId(value.id)
    setForm({ name: value.name ?? '', email: value.email ?? '', phone: value.phone ?? '', role: value.role ?? '' })
  }
  if (!value) return null
  return (
    <Dialog open onOpenChange={(o) => { if (!o) { setLastId(null); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{value.id ? 'Editar contacto' : 'Nuevo contacto'}</DialogTitle>
          <DialogDescription>El teléfono y el mail sirven para reconocer a la empresa cuando vuelva a escribir.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {(['name', 'phone', 'email', 'role'] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`ct-${k}`}>{{ name: 'Nombre', phone: 'Teléfono', email: 'Mail', role: 'Puesto' }[k]}</Label>
              <Input id={`ct-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setLastId(null); onClose() }}>Cancelar</Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => upsertContact({ id: value.id, companyId: value.companyId!, name: form.name || null, email: form.email || null, phone: form.phone || null, role: form.role || null }),
                () => { setLastId(null); onClose() },
              )
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
