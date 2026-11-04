'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, ChevronDown, FileText, Loader2, SkipForward, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FormSheet } from '@/components/ui/form-sheet'
import { ProformaPdfCheck } from '@/components/proformas/proforma-pdf-check'
import { cn } from '@/lib/utils'
import { createProforma } from '@/lib/actions/proformas'
import { matchProformaPdfBatch, type ProformaPdfGroupMatch } from '@/lib/actions/proforma-pdf'
import { appendProformaFileToFormData } from '@/lib/documents/upload-proforma-file'
import { readPdfLines } from '@/lib/pdf/read-pdf-lines'
import { extractPdfPages, proformaPdfFileName } from '@/lib/pdf/split-pages'
import {
  looksLikeArcorProforma,
  parseArcorProforma,
  type ArcorProformaGroup,
} from '@/lib/proformas/parse-arcor-pdf'
import { assessPdfGroup, type PdfGroupAssessment } from '@/lib/proformas/pdf-import'
import { toast } from 'sonner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n)

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function pagesLabel(pages: number[]) {
  if (pages.length === 0) return ''
  const sorted = [...pages].sort((a, b) => a - b)
  const contiguous = sorted.every((p, i) => i === 0 || p === sorted[i - 1] + 1)
  if (sorted.length === 1) return `hoja ${sorted[0]}`
  return contiguous ? `hojas ${sorted[0]}–${sorted[sorted.length - 1]}` : `hojas ${sorted.join(', ')}`
}

type Item = {
  group: ArcorProformaGroup
  match: ProformaPdfGroupMatch
  assessment: PdfGroupAssessment
}

type SaveResult = { ok: true } | { ok: false; error: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * "Importar PDF": sube el PDF completo de Grupo Arcor, detecta todas sus
 * proformas (compañía + jurisdicción), las revisa una por una y guarda las
 * revisadas, cada una con sólo sus hojas del PDF.
 */
export function ImportProformasPdfSheet({ open, onOpenChange }: Props) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [reading, setReading] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<Record<string, SaveResult>>({})

  const reset = () => {
    setFile(null)
    setBytes(null)
    setItems([])
    setReviewed(new Set())
    setExpanded(null)
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (picked.type !== 'application/pdf' && !picked.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Solo se permiten archivos PDF')
      return
    }
    reset()
    setFile(picked)
    setReading(true)
    try {
      const data = new Uint8Array(await picked.arrayBuffer())
      setBytes(data)
      const pages = await readPdfLines(picked)
      if (!looksLikeArcorProforma(pages)) {
        toast.error('El PDF no tiene el formato de proforma de Grupo Arcor')
        return
      }
      const parsed = parseArcorProforma(pages)
      if (parsed.errors.length > 0) toast.warning(parsed.errors.slice(0, 3).join(' · '))
      if (parsed.groups.length === 0) return

      const res = await matchProformaPdfBatch(
        parsed.groups.map((g) => ({
          proformaNumber: g.proformaNumber,
          cuit: g.cuit,
          codes: g.rows.map((r) => r.code),
        }))
      )
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const next: Item[] = parsed.groups.map((group, i) => ({
        group,
        match: res.groups[i],
        assessment: assessPdfGroup(group, res.groups[i]),
      }))
      setItems(next)
      const firstProblem = next.find((it) => it.assessment.status === 'problems')
      setExpanded(firstProblem?.group.proformaNumber ?? null)
    } catch {
      toast.error('No se pudo leer el PDF')
    } finally {
      setReading(false)
    }
  }

  const toSave = useMemo(
    () =>
      items.filter(
        (it) =>
          it.assessment.status === 'ready' &&
          reviewed.has(it.group.proformaNumber) &&
          !results[it.group.proformaNumber]?.ok
      ),
    [items, reviewed, results]
  )

  const counts = useMemo(() => {
    const c = { ready: 0, problems: 0, existing: 0, saved: 0 }
    for (const it of items) {
      if (results[it.group.proformaNumber]?.ok) c.saved++
      else c[it.assessment.status]++
    }
    return c
  }, [items, results])

  const toggleReviewed = (number: string, value: boolean) => {
    setReviewed((prev) => {
      const next = new Set(prev)
      if (value) next.add(number)
      else next.delete(number)
      return next
    })
  }

  const saveOne = async (it: Item): Promise<SaveResult> => {
    if (!bytes || !it.match.clientId) return { ok: false, error: 'Falta el PDF o el cliente' }
    let part: File
    try {
      part = await extractPdfPages(
        bytes.slice(),
        it.group.pages,
        proformaPdfFileName(it.group.proformaNumber, it.group.pages)
      )
    } catch {
      return { ok: false, error: 'No se pudieron separar sus hojas del PDF' }
    }

    const formData = new FormData()
    formData.set('client_id', it.match.clientId)
    formData.set('proforma_number', it.group.proformaNumber)
    formData.set('received_date', it.group.issueDate ?? todayIso())
    formData.set('line_items', it.assessment.lineItemsJson)
    formData.set('pdf_total', String(it.group.total))
    formData.set('pdf_proforma', it.group.proformaNumber)
    formData.set('notes', `Importada del PDF ${file?.name ?? ''} (${pagesLabel(it.group.pages)})`.trim())

    const upload = await appendProformaFileToFormData(formData, it.match.clientId, part)
    if (!upload.ok) return { ok: false, error: upload.error }

    const result = await createProforma({}, formData)
    return result.error ? { ok: false, error: result.error } : { ok: true }
  }

  const handleSave = async () => {
    if (toSave.length === 0) return
    setSaving(true)
    let saved = 0
    try {
      // De a una: una proforma puede usar viajes que la anterior acaba de facturar
      for (const it of toSave) {
        const result = await saveOne(it)
        setResults((prev) => ({ ...prev, [it.group.proformaNumber]: result }))
        if (result.ok) saved++
      }
    } finally {
      setSaving(false)
    }
    const failed = toSave.length - saved
    if (saved > 0) toast.success(`${saved} proforma${saved === 1 ? '' : 's'} guardada${saved === 1 ? '' : 's'}`)
    if (failed > 0) toast.error(`${failed} no se pudo guardar: mirá el detalle`)
    if (saved > 0) router.refresh()
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      size="wide"
      title="Importar proformas desde PDF"
      description="Subí el PDF completo de Grupo Arcor. Se arma una proforma por compañía y jurisdicción, cada una con sus hojas."
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
        {file ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">{file.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={reset}
              disabled={saving || reading}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors hover:bg-muted/30">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tocá para subir el PDF completo de la proforma</span>
            <span className="text-xs text-muted-foreground">No hace falta cortarlo: se separa solo</span>
            <input type="file" accept="application/pdf" className="sr-only" onChange={handleFile} />
          </label>
        )}

        {reading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Leyendo el PDF y buscando los viajes…
          </p>
        )}

        {items.map((it) => {
          const number = it.group.proformaNumber
          const result = results[number]
          const isOpen = expanded === number
          const status = result?.ok ? 'saved' : it.assessment.status
          return (
            <div
              key={number}
              className={cn(
                'rounded-lg border',
                status === 'problems' && 'border-destructive/40',
                status === 'saved' && 'border-emerald-500/40 bg-emerald-500/5',
                status === 'existing' && 'opacity-70'
              )}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpanded(isOpen ? null : number)}
              >
                {status === 'ready' && (
                  <CheckCircle2
                    className={cn('h-4 w-4 shrink-0', reviewed.has(number) ? 'text-emerald-600' : 'text-muted-foreground')}
                  />
                )}
                {status === 'saved' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                {status === 'problems' && <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />}
                {status === 'existing' && <SkipForward className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {number}{' '}
                    <span className="font-normal text-muted-foreground">
                      · {it.match.clientName ?? it.group.companyName}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {it.group.rows.length} viaje{it.group.rows.length === 1 ? '' : 's'} · {pagesLabel(it.group.pages)}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{fmt(it.group.total)}</span>
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
                        : reviewed.has(number)
                          ? 'Revisada'
                          : 'Para revisar'}
                </Badge>
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div className="space-y-3 border-t px-4 py-3">
                  {result && !result.ok && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      No se guardó: {result.error}
                    </p>
                  )}
                  {status === 'existing' ? (
                    <p className="text-sm text-muted-foreground">
                      La proforma {number} ya está cargada en la plataforma, así que no se vuelve a importar.
                    </p>
                  ) : (
                    <>
                      {it.assessment.priceWarnings.length > 0 && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
                          <p className="font-medium text-amber-700 dark:text-amber-500">
                            {it.assessment.priceWarnings.length} viaje
                            {it.assessment.priceWarnings.length === 1 ? '' : 's'} con precio distinto al cargado en
                            la plataforma
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Se guarda lo que dice el PDF. Revisalo si no esperabas la diferencia.
                          </p>
                          <ul className="mt-1 space-y-0.5 text-xs tabular-nums">
                            {it.assessment.priceWarnings.slice(0, 8).map((w) => (
                              <li key={w.code}>
                                {w.code}: PDF {fmt(w.pdf)} · esperado {fmt(w.expected)} ({w.diff > 0 ? '+' : ''}
                                {fmt(w.diff)})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <ProformaPdfCheck
                        proformaNumber={number}
                        review={{
                          ...it.assessment.review,
                          ok: it.assessment.status === 'ready',
                          problems: it.assessment.problems,
                        }}
                        reviewed={reviewed.has(number)}
                        onReviewedChange={(v) => toggleReviewed(number, v)}
                        disabled={saving || !!result?.ok}
                        showEstimates
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </FormSheet>
  )
}
