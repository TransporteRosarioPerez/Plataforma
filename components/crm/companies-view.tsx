'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Merge, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SERVICE_LABELS } from '@/lib/crm/constants'
import { formatCuit } from '@/lib/crm/normalize'
import { mergeCompanies, upsertCompany } from '@/lib/crm/server/actions-companies'
import type { CompanyRow } from '@/lib/crm/server/data'
import type { CrmServiceType } from '@/lib/crm/types'
import { formatDate, formatMoney, useAction } from './shared'

type Props = {
  rows: CompanyRow[]
  duplicates: { a: CompanyRow; b: CompanyRow; similarity: number }[]
}

export function CompaniesView({ rows, duplicates }: Props) {
  const [q, setQ] = useState('')
  const router = useRouter()
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((r) => [r.name, r.cuit, r.emailDomain, ...r.aliases].some((s) => s?.toLowerCase().includes(needle)))
  }, [rows, q])

  return (
    <div className="space-y-4">
      {duplicates.length > 0 && <DuplicatesCard duplicates={duplicates} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Nombre, alias, CUIT o dominio" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground">{rows.length} empresas</span>
        <div className="ml-auto"><NewCompanyDialog /></div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Cotiz.</TableHead>
                <TableHead className="text-right">Ganadas</TableHead>
                <TableHead className="hidden text-right md:table-cell">Monto ganado</TableHead>
                <TableHead className="hidden lg:table-cell">Pide</TableHead>
                <TableHead className="hidden sm:table-cell">Último contacto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/app/crm/empresas/${r.id}`)}>
                  <TableCell>
                    <Link href={`/app/crm/empresas/${r.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{r.name}</Link>
                    <div className="text-xs text-muted-foreground">
                      {[r.cuit && formatCuit(r.cuit), r.emailDomain && `@${r.emailDomain}`, r.aliases.length ? `también: ${r.aliases.join(', ')}` : null].filter(Boolean).join(' · ')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.requests}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.quotes}{r.open ? <span className="text-xs text-muted-foreground"> ({r.open} abiertas)</span> : null}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.won}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{r.wonAmount ? formatMoney(r.wonAmount) : '—'}</TableCell>
                  <TableCell className="hidden max-w-64 text-xs text-muted-foreground lg:table-cell">
                    {[r.services.map((s) => SERVICE_LABELS[s as CrmServiceType]).join(', '), r.destinations.slice(0, 4).join(', ')].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">{formatDate(r.lastContactAt)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No hay empresas{q ? ' con ese filtro' : ' todavía: se crean al pasar pedidos desde la bandeja'}.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function DuplicatesCard({ duplicates }: { duplicates: Props['duplicates'] }) {
  const { pending, run } = useAction()
  return (
    <Card className="border-amber-300 dark:border-amber-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Merge className="h-4 w-4" />Posibles duplicados</CardTitle>
        <CardDescription>Parecen la misma empresa escrita distinto. Al fusionar, todo pasa a la que elijas y el otro nombre queda como alias.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {duplicates.map(({ a, b, similarity }) => {
          // Por defecto se conserva la que tiene más historia
          const [keep, drop] = a.quotes + a.requests >= b.quotes + b.requests ? [a, b] : [b, a]
          return (
            <div key={`${a.id}-${b.id}`} className="flex flex-wrap items-center gap-2 px-6 py-2 text-sm">
              <span className="font-medium">{keep.name}</span>
              <span className="text-muted-foreground">≈</span>
              <span className="font-medium">{drop.name}</span>
              <span className="text-xs text-muted-foreground">{Math.round(similarity * 100)}% · {keep.quotes + keep.requests} vs {drop.quotes + drop.requests} registros</span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => mergeCompanies(drop.id, keep.id))}>Dejar “{keep.name}”</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => mergeCompanies(keep.id, drop.id))}>Dejar “{drop.name}”</Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function NewCompanyDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [cuit, setCuit] = useState('')
  const [domain, setDomain] = useState('')
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="mr-1 h-4 w-4" />Nueva empresa</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva empresa</DialogTitle>
          <DialogDescription>Normalmente se crean desde la bandeja. Usá esto para cargar clientes que ya conocés.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="nc-name">Nombre</Label><Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="nc-cuit">CUIT</Label><Input id="nc-cuit" value={cuit} onChange={(e) => setCuit(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="nc-domain">Dominio de mail</Label><Input id="nc-domain" placeholder="empresa.com.ar" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            disabled={pending || !name.trim()}
            onClick={() =>
              run(
                () => upsertCompany({ name, cuit: cuit || null, emailDomain: domain || null, website: null, industry: null, city: null, province: null, notes: null }),
                (r) => { setOpen(false); if (r.id) router.push(`/app/crm/empresas/${r.id}`) },
              )
            }
          >
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
