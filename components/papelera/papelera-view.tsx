'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArchiveRestore, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { restoreRecord } from '@/lib/actions/restore'
import { getEntityTypeLabel } from '@/lib/deleted-records/labels'
import type { DeletedRecordRow } from '@/lib/deleted-records/types'
import { toast } from 'sonner'

type PapeleraViewProps = {
  records: DeletedRecordRow[]
}

function formatDeletedAt(date: Date) {
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PapeleraView({ records }: PapeleraViewProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const filtered = records.filter((row) => {
    const q = search.toLowerCase()
    const typeLabel = getEntityTypeLabel(row.entity).toLowerCase()
    return (
      row.label.toLowerCase().includes(q) ||
      typeLabel.includes(q)
    )
  })

  const handleRestore = async (row: DeletedRecordRow) => {
    setRestoringId(row.id)
    const result = await restoreRecord(row.entity, row.id, row.context)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      router.refresh()
    }
    setRestoringId(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Papelera</h1>
        <p className="text-muted-foreground">
          Registros dados de baja. Podés recuperarlos si se eliminó algo por error.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Eliminados</CardTitle>
              <CardDescription>
                {records.length === 0
                  ? 'No hay registros en la papelera'
                  : `${records.length} registro(s) recuperable(s)`}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {records.length === 0
                ? 'Cuando des de baja un registro, aparecerá acá para que puedas restaurarlo.'
                : 'No hay resultados para tu búsqueda.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Eliminado</TableHead>
                  <TableHead className="w-[120px] text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={`${row.entity}-${row.id}`}>
                    <TableCell className="text-muted-foreground">
                      {getEntityTypeLabel(row.entity)}
                    </TableCell>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell>{formatDeletedAt(row.deletedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restoringId === row.id}
                        onClick={() => handleRestore(row)}
                      >
                        <ArchiveRestore className="mr-2 h-4 w-4" />
                        Recuperar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
