'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fuel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FuelImportDropzone } from '@/components/fuel/fuel-import-dropzone'
import { FuelTransactionsTable } from '@/components/fuel/fuel-transactions-table'
import { previewFuelImport, confirmFuelImport } from '@/lib/actions/fuel-import'
import type { FuelImportPreview } from '@/lib/integrations/fuel/types'
import type { FuelTransaction } from '@/lib/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

type CombustibleViewProps = {
  transactions: FuelTransaction[]
  trips: { id: string; code: string; vehiclePlate?: string; trailerPlate?: string }[]
}

export function CombustibleView({ transactions, trips }: CombustibleViewProps) {
  const router = useRouter()
  const [preview, setPreview] = useState<FuelImportPreview | null>(null)
  const [csvText, setCsvText] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const unlinkedCount = transactions.filter((t) => t.matchStatus === 'unlinked').length

  const handleFileRead = async (text: string, fileName: string) => {
    setLoading(true)
    setCsvText(text)
    const result = await previewFuelImport(text, fileName)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.preview) {
      setPreview(result.preview)
      setPreviewOpen(true)
    }
  }

  const handleConfirm = async () => {
    if (!preview || !csvText) return
    setConfirming(true)
    const result = await confirmFuelImport(csvText, preview.fileName)
    setConfirming(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      setPreviewOpen(false)
      setPreview(null)
      setCsvText('')
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Fuel className="h-7 w-7" />
            Combustible
          </h1>
          <p className="text-muted-foreground">
            {transactions.length} cargas importadas
            {unlinkedCount > 0 && (
              <span className="text-destructive font-medium ml-1">
                · {unlinkedCount} sin viaje
              </span>
            )}
          </p>
        </div>
      </div>

      <FuelImportDropzone onFileRead={handleFileRead} disabled={loading} />

      <Card>
        <CardHeader>
          <CardTitle>Historial de cargas</CardTitle>
          <CardDescription>
            Extractos YPF y Shell normalizados en una sola tabla. Las filas sin viaje aparecen en rojo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FuelTransactionsTable transactions={transactions} trips={trips} />
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Vista previa de importación</DialogTitle>
            <DialogDescription>
              {preview && (
                <>
                  {preview.fileName} — {preview.rows.length} filas nuevas
                  {preview.skippedDuplicates > 0 && ` · ${preview.skippedDuplicates} duplicadas omitidas`}
                  {preview.parseErrors.length > 0 && ` · ${preview.parseErrors.length} advertencias`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="flex-1 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Patente</TableHead>
                    <TableHead>Estación</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Litros</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Viaje sugerido</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row, i) => {
                    const status = row.match.status
                    const tripCode =
                      status === 'linked'
                        ? trips.find((t) => t.id === row.match.tripId)?.code
                        : undefined
                    return (
                      <TableRow
                        key={i}
                        className={cn(
                          status === 'unlinked' && 'bg-destructive/10',
                          status === 'ambiguous' && 'bg-amber-500/10'
                        )}
                      >
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateFormatter.format(row.transactionAt)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.plate}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate">{row.stationName}</TableCell>
                        <TableCell className="text-sm max-w-[100px] truncate">{row.product}</TableCell>
                        <TableCell className="text-right text-sm">
                          {row.liters > 0 ? row.liters.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.amountNet)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.amountTotal)}</TableCell>
                        <TableCell className="font-mono text-sm">{tripCode ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={status === 'linked' ? 'secondary' : 'destructive'}>
                            {status === 'linked' ? 'Vinculado' : status === 'ambiguous' ? 'Ambiguo' : 'Sin viaje'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={confirming}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={confirming || !preview?.rows.length}>
              {confirming ? 'Importando...' : 'Confirmar importación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
