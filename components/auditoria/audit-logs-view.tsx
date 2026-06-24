'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { auditActionOptions, getAuditActionLabel, getEntityHref } from '@/lib/audit/actions'
import { buildAuditLogQuery } from '@/lib/audit/list-filters'
import type { AuditLog, AuditLogFilters, AuditLogsResult } from '@/lib/audit/types'
import type { TeamProfile } from '@/lib/data/users'
import { roleLabels, type UserRole } from '@/lib/types'

const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

type AuditLogsViewProps = {
  result: AuditLogsResult
  filters: AuditLogFilters
  profiles: TeamProfile[]
}

export function AuditLogsView({ result, filters, profiles }: AuditLogsViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(filters.q ?? '')

  const navigate = useCallback(
    (next: Partial<AuditLogFilters> & { page?: number }) => {
      const query = buildAuditLogQuery({
        ...filters,
        ...next,
        page: next.page ?? 1,
      })
      startTransition(() => {
        router.push(`/app/auditoria${query}`)
      })
    },
    [filters, router]
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate({ q, page: 1 })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label className="text-xs text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Resumen, entidad o usuario..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground">Rol</label>
          <Select
            value={filters.actorRole ?? 'all'}
            onValueChange={(value) =>
              navigate({
                actorRole: value === 'all' ? undefined : (value as UserRole),
                page: 1,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="ops">{roleLabels.ops}</SelectItem>
              <SelectItem value="superadmin">{roleLabels.superadmin}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground">Usuario</label>
          <Select
            value={filters.actorId ?? 'all'}
            onValueChange={(value) =>
              navigate({ actorId: value === 'all' ? undefined : value, page: 1 })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({roleLabels[p.role]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Acción</label>
          <Select
            value={filters.action ?? 'all'}
            onValueChange={(value) =>
              navigate({ action: value === 'all' ? undefined : value, page: 1 })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {auditActionOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => navigate({ from: e.target.value || undefined, page: 1 })}
            className="w-[150px]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => navigate({ to: e.target.value || undefined, page: 1 })}
            className="w-[150px]"
          />
        </div>

        <Button type="submit" disabled={isPending}>
          Buscar
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {result.total === 0
          ? 'Sin registros para los filtros seleccionados.'
          : `${result.total} registro${result.total === 1 ? '' : 's'} · página ${result.page} de ${result.totalPages}`}
        {' · '}
        Se conservan los últimos 90 días.
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Fecha</TableHead>
              <TableHead className="w-[180px]">Usuario</TableHead>
              <TableHead className="w-[160px]">Acción</TableHead>
              <TableHead>Resumen</TableHead>
              <TableHead className="w-[140px]">Entidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No hay logs de auditoría.
                </TableCell>
              </TableRow>
            ) : (
              result.logs.map((log) => <AuditLogRow key={log.id} log={log} />)
            )}
          </TableBody>
        </Table>
      </div>

      {result.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={result.page <= 1 || isPending}
            onClick={() => navigate({ page: result.page - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {result.page} / {result.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={result.page >= result.totalPages || isPending}
            onClick={() => navigate({ page: result.page + 1 })}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function AuditLogRow({ log }: { log: AuditLog }) {
  const href = getEntityHref(log.entityType, log.entityId)
  const label = log.entityLabel ?? log.entityId?.slice(0, 8)

  return (
    <TableRow>
      <TableCell className="text-sm whitespace-nowrap">
        {dateTimeFormatter.format(log.createdAt)}
      </TableCell>
      <TableCell>
        <div className="text-sm font-medium">{log.actorName}</div>
        <div className="text-xs text-muted-foreground">{log.actorEmail}</div>
        <Badge variant="outline" className="mt-1 text-[10px] font-normal">
          {roleLabels[log.actorRole]}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="font-normal text-xs">
          {getAuditActionLabel(log.action)}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">{log.summary}</TableCell>
      <TableCell className="text-sm">
        {href && label ? (
          <Link href={href} className="text-primary hover:underline">
            {label}
          </Link>
        ) : label ? (
          <span className="text-muted-foreground">{label}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}
