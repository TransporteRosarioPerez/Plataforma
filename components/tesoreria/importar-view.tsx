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
  type StatementUpload,
} from '@/lib/tesoreria/server/actions-import'
import type {
  ImportPreview,
  SheetCell,
  TreasuryAccount,
  TreasuryCategory,
  TreasuryImportBatch,
} from '@/lib/tesoreria/types'
import { amountClass, formatDate, formatDateTime, formatMoney, scopeLabels } from './format'
import { formatMonthLabel } from '@/lib/tesoreria/closing-labels'

const ACCEPT = '.xls,.xlsx,.csv,.pdf'
// Límite de las server actions de Next (1 MB) con margen por el base64.
const MAX_PDF_BYTES = 700 * 1024

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/** Planillas: se leen en el navegador. PDF (Mercado Pago): se manda tal cual y lo lee el servidor. */
async function fileToUpload(file: File): Promise<StatementUpload> {
  if (file.name.toLowerCase().endsWith('.pdf')) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error('El PDF es muy grande: descargá el resumen de a un mes')
    }
    return { kind: 'pdf', base64: await fileToBase64(file) }
  }
  return { kind: 'cells', cells: await readCells(file) }
}

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

/** Un archivo dentro de una carga múltiple. */
type Item = {
  key: string
  fileName: string
  upload?: StatementUpload
  preview?: ImportPreview
  error?: string
  result?: { ok: boolean; message: string }
}

export function ImportarView({ accounts, categories, batches }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [items, setItems] = useState<Item[] | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [onlyPending, setOnlyPending] = useState(false)
  const [allowClosed, setAllowClosed] = useState(false)

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  /** Lee todos los archivos y arma una vista previa por archivo (uno por vez). */
  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setLoading(true)
    const next: Item[] = []
    for (const [i, file] of files.entries()) {
      const key = `${i}-${file.name}`
      const lower = file.name.toLowerCase()
      if (!ACCEPT.split(',').some((ext) => lower.endsWith(ext))) {
        next.push({ key, fileName: file.name, error: 'Formato no soportado: subí el Excel del banco o el PDF de Mercado Pago' })
        continue
      }
      try {
        const upload = await fileToUpload(file)
        const result = await previewTreasuryImport(file.name, upload)
        next.push(
          result.preview
            ? { key, fileName: file.name, upload, preview: result.preview }
            : { key, fileName: file.name, error: result.error ?? 'No se pudo leer el extracto' }
        )
      } catch (e) {
        next.push({ key, fileName: file.name, error: e instanceof Error ? e.message : 'No se pudo leer el archivo' })
      }
    }
    setLoading(false)
    setItems(next)
    setSelectedKey(next.find((it) => it.preview)?.key ?? next[0]?.key ?? null)
    setOnlyPending(false)
    setAllowClosed(false)
  }

  /**
   * Importa en orden. El servidor vuelve a calcular cada vista previa al confirmar,
   * así que si dos archivos de la misma cuenta se superponen, el segundo saltea lo que ya cargó el primero.
   */
  const confirm = async () => {
    if (!items) return
    setConfirming(true)
    const updated = [...items]
    for (const [i, it] of updated.entries()) {
      if (!it.preview || !it.upload || it.preview.newCount === 0 || it.result?.ok) continue
      const result = await confirmTreasuryImport(it.fileName, it.upload, { allowClosedMonths: allowClosed })
      updated[i] = {
        ...it,
        result: result.error ? { ok: false, message: result.error } : { ok: true, message: result.success ?? 'Importado' },
      }
      setItems([...updated])
    }
    setConfirming(false)
    router.refresh()
    const failed = updated.filter((it) => it.result && !it.result.ok)
    const done = updated.filter((it) => it.result?.ok)
    if (failed.length === 0) {
      toast.success(
        done.length === 1
          ? done[0].result!.message
          : `Importados ${done.length} extractos. Revisá Pendientes: ahí aparecen las transferencias entre cuentas.`
      )
      setItems(null)
    } else {
      toast.error(`${failed.length} archivo${failed.length === 1 ? '' : 's'} no se pudo importar. Mirá el detalle.`)
    }
  }

  const ready = (items ?? []).filter((it) => it.preview && it.preview.newCount > 0 && !it.result?.ok)
  const totalNew = ready.reduce((acc, it) => acc + (it.preview?.newCount ?? 0), 0)
  const repeatedAccounts = (() => {
    const seen = new Map<string, number>()
    for (const it of items ?? []) if (it.preview) seen.set(it.preview.accountId, (seen.get(it.preview.accountId) ?? 0) + 1)
    return [...seen.values()].some((n) => n > 1)
  })()
  const closedWarnings = ready.filter((it) => (it.preview?.closedMonths.length ?? 0) > 0)
  const gapWarnings = (items ?? []).filter((it) => it.preview?.gap)
  const selected = items?.find((it) => it.key === selectedKey) ?? null
  const preview = selected?.preview ?? null

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
            Macro y Nación: descargá los movimientos en Excel y subilo tal cual. Mercado Pago: subí el PDF del
            resumen de cuenta. La cuenta se detecta sola y los movimientos ya cargados se saltean.
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
              if (!loading && e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files)
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
              {loading
                ? 'Leyendo los extractos…'
                : 'Arrastrá uno o varios archivos acá (por ejemplo Macro, Nación y Mercado Pago juntos) o hacé clic para elegirlos'}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files)
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

      <Dialog open={!!items} onOpenChange={(o) => !o && !confirming && setItems(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          {items && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Vista previa · {items.length} archivo{items.length === 1 ? '' : 's'}
                </DialogTitle>
                <DialogDescription>
                  Revisá cada extracto antes de importar. Hacé clic en un archivo para ver sus movimientos.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Nuevos</TableHead>
                      <TableHead className="text-right">Ya cargados</TableHead>
                      <TableHead className="text-right">Pendientes</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow
                        key={it.key}
                        onClick={() => it.preview && setSelectedKey(it.key)}
                        className={cn(it.preview && 'cursor-pointer', it.key === selectedKey && 'bg-muted/60')}
                      >
                        <TableCell className="max-w-[220px] truncate" title={it.fileName}>{it.fileName}</TableCell>
                        <TableCell>{it.preview?.accountName ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {it.preview ? `${formatDate(it.preview.dateFrom)} – ${formatDate(it.preview.dateTo)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{it.preview?.newCount ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{it.preview?.duplicateCount ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{it.preview?.pendingCount ?? '—'}</TableCell>
                        <TableCell className="text-sm">
                          {it.result ? (
                            <span className={it.result.ok ? 'text-green-700 dark:text-green-400' : 'text-destructive'}>
                              {it.result.ok ? '✓ Importado' : it.result.message}
                            </span>
                          ) : it.error ? (
                            <span className="text-destructive">{it.error}</span>
                          ) : it.preview && it.preview.newCount === 0 ? (
                            <span className="text-muted-foreground">Nada nuevo</span>
                          ) : it.preview && it.preview.closedMonths.length > 0 ? (
                            <span className="text-red-700 dark:text-red-400">Mes cerrado</span>
                          ) : it.preview && it.preview.gap ? (
                            <span className="text-amber-700 dark:text-amber-400">Posible hueco</span>
                          ) : it.preview && (it.preview.balanceBreaks > 0 || it.preview.errors.length > 0) ? (
                            <span className="text-amber-700 dark:text-amber-400">Listo, con avisos</span>
                          ) : (
                            <span>Listo</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {gapWarnings.map((it) => {
                const gap = it.preview!.gap!
                return (
                  <div key={`gap-${it.key}`} className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <strong>{it.preview!.accountName}: puede faltar un extracto.</strong> Lo último cargado termina el{' '}
                      {formatDate(gap.lastLoadedDate)} con saldo {formatMoney(gap.lastLoadedBalance)}, pero este archivo arranca el{' '}
                      {formatDate(gap.fileStartDate)} con {formatMoney(gap.fileOpeningBalance)}. Hay {formatMoney(Math.abs(gap.difference))}{' '}
                      que {gap.difference < 0 ? 'salieron' : 'entraron'} en el medio y no están en ningún archivo. Bajá el extracto de esos días.
                    </span>
                  </div>
                )
              })}

              {closedWarnings.length > 0 && (
                <label className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                  <input type="checkbox" className="mt-1" checked={allowClosed} onChange={(e) => setAllowClosed(e.target.checked)} />
                  <span>
                    {closedWarnings.map((it) => `${it.preview!.accountName}: ${it.preview!.closedMonths.map(formatMonthLabel).join(', ')}`).join(' · ')}{' '}
                    {closedWarnings.length === 1 && closedWarnings[0].preview!.closedMonths.length === 1 ? 'ya está cerrado' : 'ya están cerrados'}.
                    Si importás, esos meses cambian. Marcá esta casilla para cargarlos igual (queda registrado en Auditoría).
                  </span>
                </label>
              )}

              {repeatedAccounts && (
                <p className="text-xs text-muted-foreground">
                  Hay más de un archivo de la misma cuenta: si se superponen, al importar se saltean los movimientos repetidos.
                </p>
              )}

              {preview && (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-sm font-medium">
                    {preview.accountName} · {preview.fileName}
                    {preview.chequeMatches > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {preview.chequeMatches} cheque{preview.chequeMatches === 1 ? '' : 's'} del registro vinculado{preview.chequeMatches === 1 ? '' : 's'}
                      </span>
                    )}
                  </p>

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
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {preview.errors.slice(0, 5).map((e) => <li key={e}>• {e}</li>)}
                  {preview.errors.length > 5 && <li>• y {preview.errors.length - 5} avisos más</li>}
                </ul>
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
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setItems(null)} disabled={confirming}>
                  {items.some((it) => it.result?.ok) ? 'Cerrar' : 'Cancelar'}
                </Button>
                <Button onClick={confirm} disabled={confirming || ready.length === 0 || (closedWarnings.length > 0 && !allowClosed)}>
                  {confirming
                    ? 'Importando…'
                    : ready.length > 1
                      ? `Importar ${ready.length} extractos (${totalNew} movimientos)`
                      : `Importar ${totalNew} movimientos`}
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
