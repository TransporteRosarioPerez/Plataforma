'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FileWarning, Search, ArrowRight, RefreshCw, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  documentStatusLabels,
  documentStatusColors,
} from '@/lib/documents/status'
import { formatExpiryTiming } from '@/lib/documents/dates'
import { entityTypeLabels, entityTypeOrder } from '@/lib/documents/entity-labels'
import {
  DocumentRenewDialog,
  type DocumentRenewTarget,
} from '@/components/documents/document-renew-dialog'
import type { ExpiringDocumentRow } from '@/lib/data/documents'
import type { DocumentEntityType } from '@/lib/types'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type EntityFilter = DocumentEntityType | 'all'

type ExpiringDocumentsTableProps = {
  documents: ExpiringDocumentRow[]
  title?: string
  description?: string
  showFilters?: boolean
  maxRows?: number
  footerLink?: { href: string; label: string }
  compact?: boolean
  enableRenew?: boolean
}

export function ExpiringDocumentsTable({
  documents,
  title = 'Documentos por vencer',
  description = 'Renová desde acá o entrá a la ficha de la entidad para más contexto',
  showFilters = true,
  maxRows,
  footerLink,
  compact = false,
  enableRenew = true,
}: ExpiringDocumentsTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'expiring_soon' | 'expired'>('all')
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [renewTarget, setRenewTarget] = useState<DocumentRenewTarget | null>(null)
  const [renewOpen, setRenewOpen] = useState(false)

  const openRenew = (doc: ExpiringDocumentRow) => {
    if (!enableRenew) return
    setRenewTarget({
      id: doc.id,
      entityId: doc.entityId,
      entityType: doc.entityType,
      name: doc.documentName,
      entityLabel: doc.entityLabel,
    })
    setRenewOpen(true)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return documents.filter((d) => {
      const matchSearch =
        !search ||
        d.entityLabel.toLowerCase().includes(q) ||
        d.documentName.toLowerCase().includes(q) ||
        entityTypeLabels[d.entityType].toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || d.status === statusFilter
      const matchEntity = entityFilter === 'all' || d.entityType === entityFilter
      return matchSearch && matchStatus && matchEntity
    })
  }, [documents, search, statusFilter, entityFilter])

  const visible = maxRows ? filtered.slice(0, maxRows) : filtered
  const hasMore = maxRows != null && filtered.length > maxRows

  const countsByEntity = useMemo(() => {
    const counts: Record<DocumentEntityType, number> = { vehicle: 0, driver: 0, company: 0 }
    for (const d of documents) counts[d.entityType]++
    return counts
  }, [documents])

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
              {showFilters && !compact && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              )}
            </div>

            {showFilters && (
              <>
                <div className="flex flex-wrap gap-2">
                  <FilterButton active={entityFilter === 'all'} onClick={() => setEntityFilter('all')}>
                    Todas ({documents.length})
                  </FilterButton>
                  {entityTypeOrder.map((entity) => (
                    <FilterButton
                      key={entity}
                      active={entityFilter === entity}
                      onClick={() => setEntityFilter(entity)}
                    >
                      {entityTypeLabels[entity]} ({countsByEntity[entity]})
                    </FilterButton>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['all', 'expiring_soon', 'expired'] as const).map((s) => (
                    <FilterButton
                      key={s}
                      active={statusFilter === s}
                      onClick={() => setStatusFilter(s)}
                    >
                      {s === 'all' ? 'Todos los estados' : documentStatusLabels[s]}
                    </FilterButton>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileWarning className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">
                {documents.length === 0
                  ? 'No hay vencimientos pendientes'
                  : 'No hay documentos con estos filtros'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entidad</TableHead>
                    {!compact && <TableHead>Categoría</TableHead>}
                    <TableHead>Documento</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead>Plazo</TableHead>
                    <TableHead>Estado</TableHead>
                    {enableRenew && <TableHead className="w-[120px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className={enableRenew ? 'cursor-pointer hover:bg-muted/50' : undefined}
                      onClick={() => openRenew(doc)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Link href={doc.entityHref} className="font-medium hover:underline">
                          {doc.entityLabel}
                        </Link>
                        {compact && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {entityTypeLabels[doc.entityType]}
                          </div>
                        )}
                      </TableCell>
                      {!compact && (
                        <TableCell>
                          <Badge variant="secondary">{entityTypeLabels[doc.entityType]}</Badge>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{doc.documentName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {doc.expiryDate ? dateFormatter.format(doc.expiryDate) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatExpiryTiming(doc.daysUntilExpiry) || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={documentStatusColors[doc.status]}>
                          {documentStatusLabels[doc.status]}
                        </Badge>
                      </TableCell>
                      {enableRenew && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRenew(doc)}
                            >
                              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                              Renovar
                            </Button>
                            <Button variant="ghost" size="icon" asChild title="Ver ficha">
                              <Link href={doc.entityHref}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {hasMore && footerLink && (
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={footerLink.href}>
                      {footerLink.label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {enableRenew && (
        <DocumentRenewDialog
          open={renewOpen}
          onOpenChange={setRenewOpen}
          document={renewTarget}
        />
      )}
    </>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm border ${
        active ? 'bg-primary text-primary-foreground' : 'bg-background'
      }`}
    >
      {children}
    </button>
  )
}
