'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, FileText, Loader2, SkipForward, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { FormSheet } from '@/components/ui/form-sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { createInvoice } from '@/lib/actions/invoices'
import { matchInvoicePdfs } from '@/lib/actions/invoice-pdf'
import { appendInvoiceFileToFormData } from '@/lib/documents/upload-invoice-file'
import { readPdfLines } from '@/lib/pdf/read-pdf-lines'
import { looksLikeArcaInvoice, parseArcaInvoice, type ArcaInvoiceParse } from '@/lib/invoices/parse-arca-pdf'
import { assessInvoiceImport, type BillableProforma } from '@/lib/invoices/pdf-import'
import { toast } from 'sonner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n)

type Item = {
  key: string
  file: File
  inv: ArcaInvoiceParse | null
  /** Error de lectura (no es una factura de ARCA, PDF dañado…). */
  readError: string | null
  proformaId: string | null
  candidateIds: string[]
  duplicateInvoiceNumber: boolean
  alreadyInvoicedProforma: string | null
}

type SaveResult = { ok: true } | { ok: false; error: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * "Importar PDFs": varias facturas de ARCA a la vez. Cada una se vincula sola
 * con su proforma (por el número del detalle, o por neto + CUIT), se revisa y
 * se guarda con el IVA y total que imprimió ARCA.
 */
export function ImportInvoicesPdfSheet({ open, onOpenChange }: Props) {
  const router = useRouter()
  const [reading, setReading] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [billable, setBillable] = useState<BillableProforma[]>([])
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set())
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<Record<string, SaveResult>>({})

  const reset = () => {
    setItems([])
    setBillable([])
    setReviewed(new Set())
    setResults({})
  }

  const handleOpenChange = (next: boolean) => {
    if (saving) return
    if (!next) {
      if (Object.values(results).some((r) => r.ok)) router.refresh()
      reset()
    }
    onOpenChange(next)
  }

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    )
    e.target.value = ''
    if (files.length === 0) return
    reset()
    setReading(true)
    try {
      const parsed: Item[] = []
      for (const [i, file] of files.entries()) {
        const base: Item = {
          key: `${i}-${file.name}`,
          file,
          inv: null,
          readError: null,
          proformaId: null,
          candidateIds: [],
          duplicateInvoiceNumber: false,
          alreadyInvoicedProforma: null,
        }
        try {
          const pages = await readPdfLines(file)
          if (!looksLikeArcaInvoice(pages)) {
            parsed.push({ ...base, readError: 'No parece una factura de ARCA' })
            continue
          }
          parsed.push({ ...base, inv: parseArcaInvoice(pages) })
        } catch {
          parsed.push({ ...base, readError: 'No se pudo leer el PDF' })
        }
      }

      const readable = parsed.filter((it) => it.inv)
      if (readable.length > 0) {
        const res = await matchInvoicePdfs(
          readable.map((it) => ({
            invoiceNumber: it.inv!.invoiceNumber,
            neto: it.inv!.neto,
            clientCuit: it.inv!.clientCuit,
            proformaNumbers: it.inv!.proformaNumbers,
          }))
        )
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setBillable(res.billable)
        readable.forEach((it, i) => {
          const r = res.results[i]
          it.proformaId = r.proformaId
          it.candidateIds = r.candidateIds
          it.duplicateInvoiceNumber = r.duplicateInvoiceNumber
          it.alreadyInvoicedProforma = r.alreadyInvoicedProforma
        })
      }
      setItems(parsed)
    } finally {
      setReading(false)
    }
  }

  const proformaById = useMemo(() => new Map(billable.map((p) => [p.id, p])), [billable])

  const assessed = useMemo(() => {
    const usage = new Map<string, number>()
    for (const it of items) if (it.proformaId) usage.set(it.proformaId, (usage.get(it.proformaId) ?? 0) + 1)
    return items.map((it) => {
      if (!it.inv) {
        return { it, status: 'problems' as const, problems: [it.readError ?? 'No se pudo leer'], netoDiff: null }
      }
      const proforma = it.proformaId ? proformaById.get(it.proformaId) ?? null : null
      const a = assessInvoiceImport(it.inv, proforma, {
        duplicateInvoiceNumber: it.duplicateInvoiceNumber,
        alreadyInvoicedProforma: it.alreadyInvoicedProforma,
        proformaTakenByAnother: !!it.proformaId && (usage.get(it.proformaId) ?? 0) > 1,
      })
      return { it, ...a }
    })
  }, [items, proformaById])

  const toSave = assessed.filter(
    (a) => a.status === 'ready' && reviewed.has(a.it.key) && !results[a.it.key]?.ok
  )

  const setProforma = (key: string, proformaId: string) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, proformaId } : it)))
    setReviewed((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const toggleReviewed = (key: string, value: boolean) => {
    setReviewed((prev) => {
      const next = new Set(prev)
      if (value) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const saveOne = async (it: Item): Promise<SaveResult> => {
    const inv = it.inv
    const proforma = it.proformaId ? proformaById.get(it.proformaId) : null
    if (!inv || !proforma?.clientId || inv.neto == null || inv.iva == null || inv.total == null) {
      return { ok: false, error: 'Faltan datos de la factura o la proforma' }
    }
    const formData = new FormData()
    formData.set('proforma_id', proforma.id)
    formData.set('invoice_number', inv.invoiceNumber ?? '')
    formData.set('invoice_type', inv.invoiceType ?? 'A')
    formData.set('issue_date', inv.issueDate ?? '')
    formData.set('pdf_neto', String(inv.neto))
    formData.set('pdf_iva', String(inv.iva))
    formData.set('pdf_total', String(inv.total))
    formData.set('pdf_lines', String(Math.max(1, inv.lines.length)))

    const upload = await appendInvoiceFileToFormData(formData, proforma.clientId, it.file)
    if (!upload.ok) return { ok: false, error: upload.error }

    const result = await createInvoice({}, formData)
    return result.error ? { ok: false, error: result.error } : { ok: true }
  }

  const handleSave = async () => {
    if (toSave.length === 0) return
    setSaving(true)
    let saved = 0
    try {
      for (const a of toSave) {
        const result = await saveOne(a.it)
        setResults((prev) => ({ ...prev, [a.it.key]: result }))
        if (result.ok) saved++
      }
    } finally {
      setSaving(false)
    }
    const failed = toSave.length - saved
    if (saved > 0) toast.success(`${saved} factura${saved === 1 ? '' : 's'} guardada${saved === 1 ? '' : 's'}`)
    if (failed > 0) toast.error(`${failed} no se pudo guardar: mirá el detalle`)
    if (saved > 0) router.refresh()
  }

  const counts = { ready: 0, problems: 0, existing: 0, saved: 0 }
  for (const a of assessed) {
    if (results[a.it.key]?.ok) counts.saved++
    else counts[a.status]++
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      size="wide"
      title="Importar facturas desde PDF"
      description="Subí las facturas de ARCA juntas. Cada una se vincula sola con su proforma y se guarda con el IVA de ARCA."
      footer={
        <div className="flex w-full flex-col gap-2">
          {items.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {counts.ready} lista{counts.ready === 1 ? '' : 's'} · {counts.problems} con problemas ·{' '}
              {counts.existing} ya cargada{counts.existing === 1 ? '' : 's'}
              {counts.saved > 0 ? ` · ${counts.saved} guardada${counts.saved === 1 ? '' : 's'}` : ''}
            </p>
          )}
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              {counts.saved > 0 ? 'Cerrar' : 'Cancelar'}
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleSave}
              disabled={saving || reading || toSave.length === 0}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {toSave.length === 0
                ? 'Revisá al menos una'
                : `Guardar ${toSave.length} revisada${toSave.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <label
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 text-center transition-colors hover:bg-muted/30',
            items.length > 0 ? 'py-3' : 'py-8'
          )}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {items.length > 0 ? 'Elegir otras facturas' : 'Tocá para elegir los PDFs de las facturas'}
          </span>
          <span className="text-xs text-muted-foreground">Podés elegir varios a la vez</span>
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="sr-only"
            onChange={handleFiles}
            disabled={saving || reading}
          />
        </label>

        {reading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Leyendo las facturas…
          </p>
        )}

        {assessed.map(({ it, status: baseStatus, problems, netoDiff }) => {
          const result = results[it.key]
          const status = result?.ok ? 'saved' : baseStatus
          const inv = it.inv
          const proforma = it.proformaId ? proformaById.get(it.proformaId) ?? null : null
          const options = it.candidateIds.length > 0 ? it.candidateIds : billable.map((p) => p.id)
          return (
            <div
              key={it.key}
              className={cn(
                'rounded-lg border text-sm',
                status === 'problems' && 'border-destructive/40',
                status === 'saved' && 'border-emerald-500/40 bg-emerald-500/5',
                status === 'existing' && 'opacity-70'
              )}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {status === 'ready' && (
                  <CheckCircle2
                    className={cn('h-4 w-4 shrink-0', reviewed.has(it.key) ? 'text-emerald-600' : 'text-muted-foreground')}
                  />
                )}
                {status === 'saved' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                {status === 'problems' && <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />}
                {status === 'existing' && <SkipForward className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {inv?.invoiceNumber ? `Factura ${inv.invoiceType ?? ''} ${inv.invoiceNumber}` : it.file.name}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <FileText className="h-3 w-3 shrink-0" /> {it.file.name}
                    {inv?.issueDate ? ` · ${inv.issueDate.split('-').reverse().join('/')}` : ''}
                  </p>
                </div>
                {inv?.total != null && <span className="font-semibold tabular-nums">{fmt(inv.total)}</span>}
                <Badge
                  variant={status === 'problems' ? 'destructive' : status === 'existing' ? 'outline' : 'secondary'}
                  className="shrink-0"
                >
                  {status === 'saved'
                    ? 'Guardada'
                    : status === 'existing'
                      ? 'Ya cargada'
                      : status === 'problems'
                        ? 'Con problemas'
                        : reviewed.has(it.key)
                          ? 'Revisada'
                          : 'Para revisar'}
                </Badge>
              </div>

              {status !== 'existing' && inv && (
                <div className="space-y-2 border-t px-4 py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="text-muted-foreground">Proforma</span>
                    <Select
                      value={it.proformaId ?? ''}
                      onValueChange={(v) => setProforma(it.key, v)}
                      disabled={saving || !!result?.ok}
                    >
                      <SelectTrigger className="sm:w-96">
                        <SelectValue placeholder="Elegir proforma pendiente" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((id) => {
                          const p = proformaById.get(id)
                          if (!p) return null
                          return (
                            <SelectItem key={id} value={id}>
                              {p.proformaNumber} — {p.clientName} ({fmt(p.subtotal)})
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Neto factura</p>
                      <p className="font-medium">{inv.neto == null ? '—' : fmt(inv.neto)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Neto proforma</p>
                      <p className={cn('font-medium', netoDiff != null && netoDiff !== 0 && 'text-destructive')}>
                        {proforma ? fmt(proforma.subtotal) : '—'}
                        {netoDiff === 0 ? ' ✓' : netoDiff != null ? ` (dif. ${fmt(netoDiff)})` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">IVA (ARCA)</p>
                      <p className="font-medium">{inv.iva == null ? '—' : fmt(inv.iva)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-medium">{inv.total == null ? '—' : fmt(inv.total)}</p>
                    </div>
                  </div>

                  {result && !result.ok && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">No se guardó: {result.error}</p>
                  )}
                  {problems.length > 0 && !result?.ok && (
                    <ul className="list-disc space-y-0.5 pl-4 text-destructive">
                      {problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}

                  <label
                    className={cn(
                      'flex items-center gap-2 pt-1',
                      status === 'ready' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <Checkbox
                      checked={reviewed.has(it.key) && (status === 'ready' || status === 'saved')}
                      onCheckedChange={(v) => toggleReviewed(it.key, v === true)}
                      disabled={saving || status !== 'ready'}
                    />
                    <span>Revisé la factura y la proforma</span>
                  </label>
                </div>
              )}

              {(status === 'existing' || !inv) && problems.length > 0 && (
                <p className="border-t px-4 py-2 text-muted-foreground">{problems.join(' · ')}</p>
              )}
            </div>
          )
        })}
      </div>
    </FormSheet>
  )
}
