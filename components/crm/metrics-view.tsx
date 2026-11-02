'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CHANNEL_LABELS, METRIC_PERIODS as PERIODS, SERVICE_LABELS, STAGE_LABELS } from '@/lib/crm/constants'
import type { CrmMetrics } from '@/lib/crm/metrics'
import { formatDate, formatMoney } from './shared'


export function MetricsView({ m, period, from, to }: { m: CrmMetrics; period: string; from: string; to: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`)
  const hours = m.medianResponseHours

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={period}
          onValueChange={(v) => {
            const p = new URLSearchParams(params.toString())
            p.set('dias', v)
            router.replace(`${pathname}?${p.toString()}`, { scroll: false })
          }}
        >
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{formatDate(from)} al {formatDate(to)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Pedidos recibidos" value={String(m.requests)} hint={m.discarded ? `${m.discarded} descartados` : undefined} />
        <Kpi label="Empresas que consultaron" value={String(m.companies)} hint={`${m.newCompanies} nuevas`} />
        <Kpi label="Cotizaciones ganadas" value={`${m.won} de ${m.won + m.lost}`} hint={`Conversión ${pct(m.winRate)}`} />
        <Kpi label="Monto ganado" value={formatMoney(m.wonAmount)} hint={`En juego: ${formatMoney(m.pipelineAmount)}`} />
        <Kpi
          label="Respondidas en el día"
          value={pct(m.sameDayRate)}
          hint={hours == null ? 'Sin envíos en el período' : `Mediana ${hours < 1 ? `${Math.round(hours * 60)} min` : `${hours.toFixed(1).replace('.', ',')} h`}`}
        />
        <Kpi label="Abiertas hoy" value={String(m.open)} />
        <Kpi label="Perdidas" value={String(m.lost)} />
        <Kpi label="En bandeja sin revisar" value={String(m.pending)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Por canal"
          description="Pedidos recibidos y cuántos terminaron ganados"
          rows={m.byChannel.map((c) => ({ label: CHANNEL_LABELS[c.key], value: c.count, note: `${c.won} ${c.won === 1 ? 'ganada' : 'ganadas'}` }))}
        />
        <BarList title="Servicio pedido" rows={m.byService.map((s) => ({ label: SERVICE_LABELS[s.key], value: s.count }))} empty="Sin servicio cargado" />
        <BarList title="Destinos más pedidos" rows={m.byDestination.slice(0, 10).map((d) => ({ label: d.key, value: d.count }))} empty="Sin destinos cargados" />
        <BarList title="Motivos de pérdida" rows={m.lostReasons.map((r) => ({ label: r.key, value: r.count }))} empty="No se perdieron cotizaciones" />
      </div>

      <WeeklyBars weekly={m.weekly} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Empresas que más consultan</CardTitle>
          <CardDescription>Etapa actual de las cotizaciones recibidas en el período: {m.byStage.map((s) => `${STAGE_LABELS[s.key]} ${s.count}`).join(' · ') || '—'}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Cotizaciones</TableHead>
                <TableHead className="text-right">Ganadas</TableHead>
                <TableHead className="text-right">Monto ganado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.topCompanies.map((c) => (
                <TableRow key={c.companyId}>
                  <TableCell><Link href={`/app/crm/empresas/${c.companyId}`} className="font-medium hover:underline">{c.name}</Link></TableCell>
                  <TableCell className="text-right tabular-nums">{c.requests}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.quotes}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.won}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.wonAmount ? formatMoney(c.wonAmount) : '—'}</TableCell>
                </TableRow>
              ))}
              {m.topCompanies.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Sin datos en el período.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

/** Barras horizontales de un solo color; el valor va escrito, no depende del color. */
function BarList({ title, description, rows, empty = 'Sin datos' }: { title: string; description?: string; rows: { label: string; value: number; note?: string }[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.label} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm" title={`${r.label}: ${r.value}${r.note ? ` · ${r.note}` : ''}`}>
                <span className="truncate">{r.label}</span>
                <span className="h-2.5 rounded-r bg-muted">
                  <span className="block h-full rounded-r bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">
                  {r.value}
                  {r.note && <span className="ml-1.5 text-xs text-muted-foreground">{r.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function WeeklyBars({ weekly }: { weekly: CrmMetrics['weekly'] }) {
  if (weekly.length < 2) return null
  const max = Math.max(1, ...weekly.map((w) => w.requests))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pedidos por semana</CardTitle>
        <CardDescription>Semana que empieza el lunes indicado; el número arriba de cada barra son los pedidos, abajo las ganadas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-44 items-end gap-1 overflow-x-auto border-b pb-px">
          {weekly.map((w) => (
            <div key={w.week} className="flex min-w-7 flex-1 flex-col items-center justify-end gap-1" title={`Semana del ${formatDate(w.week)}: ${w.requests} pedidos, ${w.won} ganadas`}>
              <span className="text-xs tabular-nums text-muted-foreground">{w.requests}</span>
              <span className="w-full max-w-10 rounded-t bg-primary" style={{ height: `${Math.max(2, (w.requests / max) * 120)}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1 overflow-x-auto">
          {weekly.map((w) => (
            <div key={w.week} className="min-w-7 flex-1 text-center text-[10px] leading-tight text-muted-foreground">
              {formatDate(w.week).slice(0, 5)}
              <div className="tabular-nums text-foreground">{w.won ? `✓${w.won}` : ''}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
