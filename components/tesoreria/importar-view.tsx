'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, FileSpreadsheet, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  confirmTreasuryImport,
  deleteImportBatch,
  previewTreasuryImport,
} from '@/lib/tesoreria/server/actions-import'
import type {
  ImportPreview,
  SheetCell,
  TreasuryAccount,
  TreasuryCategory,
  TreasuryImportBatch,
} from '@/lib/tesoreria/types'
import { amountClass, formatDate, formatDateTime, formatMoney, scopeLabels } from './format'

const ACCEPT = '.xls,.xlsx,.csv'

/** Lee la primera hoja del archivo en el navegador y devuelve las celdas crudas. */
async function readCells(file: File): Promise<SheetCell[][]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('El archivo no tiene hojas')
  return XLSX.utils.sheet_to_json<SheetCell[]>(sheet, { header: 1, raw: true, defval: null, blankrows: false })
}

type Props = {
  accounts: TreasuryAccount[]
  categories: TreasuryCategory[]
  batches: TreasuryImportBatch[]
}

export function ImportarView({ accounts, categories, batches }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [cells, setCells] = useState<SheetCell[][] | null>(null)
  const [onlyPending, setOnlyPending] = useState(false)

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const handleFile = async (file: File) => {
    const lower = file.name.toLowerCase()
    if (!ACCEPT.split(',').some((ext) => lower.endsWith(ext))) {
      toast.error('Subí un archivo .xls, .xlsx o .csv')
      return
    }
    setLoading(true)
    try {
      const read = await readCells(file)
      const result = await previewTreasuryImport(file.name, read)
      if (result.error || !result.preview) {
        toast.error(result.error ?? 'No se pudo leer el extracto')
        return
      }
      setCells(read)
      setPreview(result.preview)
      setOnlyPending(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo leer el archivo')
    } finally {
      setLoading(false)
    }
  }

  const confirm = async () => {
    if (!preview || !cells) return
    setConfirming(true)
    const result = await confirmTreasuryImport(preview.fileName, cells)
    setConfirming(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      setPreview(null)
      setCells(null)
      router.refresh()
    }
  }

  const onDeleteBatch = async (batch: TreasuryImportBatch) => {
    if (!window.confirm(`¿Enviar a la papelera la importación "${batch.fileName}" y sus ${batch.rowCount} movimientos?`)) return
    const r = await deleteImportBatch(batch.id)
    if (r.error) toast.error(r.error)
    else {
      toast.success(r.success)
      router.refresh()
    }
  }

  const visibleRows = preview
    ? preview.rows.filter((r) => !r.isDuplicate && (!onlyPending || r.result.classification === 'pending'))
    : []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Importar extracto</CardTitle>
          <CardDescription>
            Descargá los movimientos desde el home banking y subí el Excel tal cual. El banco se detecta solo
            (Macro y Nación; Mercado Pago próximamente). Los movimientos ya cargados se saltean.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              if (!loading) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files[0]
              if (file && !loading) void handleFile(file)
            }}
            onClick={() => !loading && inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
              loading && 'pointer-events-none opacity-60'
            )}
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              {loading ? 'Leyendo el extracto…' : 'Arrastrá el archivo acá o hacé clic para elegirlo'}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importaciones anteriores</CardTitle>
          <CardDescription>Si subiste un archivo equivocado, mandalo a la papelera: se van con él todos sus movimientos.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Archivo</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Movimientos</TableHead>
                <TableHead className="text-right">Pendientes al importar</TableHead>
                <TableHead>Importado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Todavía no importaste extractos</TableCell>
                </TableRow>
              )}
              {batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-[260px] truncate">{b.fileName}</span>
                    {b.balanceBreaks > 0 && (
                      <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-300">
                        {b.balanceBreaks} corte{b.balanceBreaks === 1 ? '' : 's'} de saldo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{accountName.get(b.accountId)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(b.dateFrom)} – {formatDate(b.dateTo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.rowCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.pendingCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(b.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onDeleteBatch(b)} title="Enviar a la papelera">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && !confirming && setPreview(null)}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-5xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>Vista previa · {preview.accountName}</DialogTitle>
                <DialogDescription>
                  {preview.fileName} · del {formatDate(preview.dateFrom)} al {formatDate(preview.dateTo)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Nuevos" value={preview.newCount} />
                <Stat label="Ya cargados (se saltean)" value={preview.duplicateCount} muted />
                <Stat label="Se clasifican solos" value={preview.autoCount} tone="text-green-700 dark:text-green-400" />
                <Stat label="Quedan pendientes" value={preview.pendingCount} tone="text-amber-700 dark:text-amber-400" />
              </div>

              {preview.balanceBreaks > 0 && (
                <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    El saldo del banco no encadena en {preview.balanceBreaks} punto{preview.balanceBreaks === 1 ? '' : 's'}.
                    Puede ser un ajuste del banco fuera de orden o un movimiento que falta en el archivo. Revisalo antes del cierre del mes.
                  </span>
                </div>
              )}
              {preview.errors.length > 0 && (
                <p className="text-xs text-muted-foreground">{preview.errors.length} filas no se pudieron leer y se omiten.</p>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Button size="sm" variant={onlyPending ? 'outline' : 'secondary'} onClick={() => setOnlyPending(false)}>Todos</Button>
                <Button size="sm" variant={onlyPending ? 'secondary' : 'outline'} onClick={() => setOnlyPending(true)}>Sólo pendientes</Button>
              </div>

              <div className="max-h-[45vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="w-24">Ámbito</TableHead>
                      <TableHead className="w-36 text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((r) => (
                      <TableRow key={r.dedupKey}>
                        <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.txDate)}</TableCell>
                        <TableCell className="max-w-[380px] truncate font-mono text-xs" title={r.description}>{r.description}</TableCell>
                        <TableCell>
                          {r.result.classification === 'pending' ? (
                            <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-300">Pendiente</Badge>
                          ) : (
                            <span className="text-sm">
                              {r.result.categoryId ? categoryName.get(r.result.categoryId) : '—'}
                              {r.result.transferAccountId && (
                                <span className="ml-1 text-xs text-muted-foreground">→ {accountName.get(r.result.transferAccountId)}</span>
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{r.result.scope ? scopeLabels[r.result.scope] : r.result.isInternal ? 'Interno' : '—'}</TableCell>
                        <TableCell className={`text-right tabular-nums ${amountClass(r.amount)}`}>{formatMoney(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPreview(null)} disabled={confirming}>Cancelar</Button>
                <Button onClick={confirm} disabled={confirming || preview.newCount === 0}>
                  {confirming ? 'Importando…' : `Importar ${preview.newCount} movimientos`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value, tone, muted }: { label: string; value: number; tone?: string; muted?: boolean }) {
  return (
    <div className={cn('rounded-lg border p-3', muted && 'bg-muted/40')}>
      <div className={cn('text-2xl font-bold tabular-nums', tone)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
