'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormSheet } from '@/components/ui/form-sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Field, FieldLabel } from '@/components/ui/field'
import { createInvoice } from '@/lib/actions/invoices'
import { appendInvoiceFileToFormData } from '@/lib/documents/upload-invoice-file'
import { calculateInvoiceAmounts, INVOICE_IVA_RATE } from '@/lib/invoices/calculate'
import { looksLikeArcaInvoice, parseArcaInvoice, type ArcaInvoiceParse } from '@/lib/invoices/parse-arca-pdf'
import { roundCents } from '@/lib/pdf/numbers'
import { readPdfLines } from '@/lib/pdf/read-pdf-lines'
import type { Proforma } from '@/lib/types'
import { toast } from 'sonner'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

type CreateInvoiceSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  billableProformas: Proforma[]
}

export function CreateInvoiceSheet({ open, onOpenChange, billableProformas }: CreateInvoiceSheetProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [proformaId, setProformaId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceType, setInvoiceType] = useState<'A' | 'B' | 'C'>('A')
  const [issueDate, setIssueDate] = useState(todayIso())
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfReading, setPdfReading] = useState(false)
  const [pdfInvoice, setPdfInvoice] = useState<ArcaInvoiceParse | null>(null)

  const selectedProforma = useMemo(
    () => billableProformas.find((p) => p.id === proformaId) ?? null,
    [billableProformas, proformaId]
  )

  // Con PDF de ARCA: neto, IVA y total impresos. Sin PDF: estimación sobre el neto.
  const pdfAmounts =
    pdfInvoice && pdfInvoice.neto != null && pdfInvoice.iva != null && pdfInvoice.total != null
      ? { subtotal: pdfInvoice.neto, iva: pdfInvoice.iva, total: pdfInvoice.total }
      : null

  const amounts = useMemo(
    () => pdfAmounts ?? (selectedProforma ? calculateInvoiceAmounts(selectedProforma.subtotal) : null),
    [pdfAmounts?.subtotal, pdfAmounts?.iva, pdfAmounts?.total, selectedProforma]
  )

  const netoDiff =
    pdfAmounts && selectedProforma ? roundCents(pdfAmounts.subtotal - selectedProforma.subtotal) : 0
  const pdfBlocksSave = !!pdfAmounts && (netoDiff !== 0 || (pdfInvoice?.errors.length ?? 0) > 0)

  const resetForm = () => {
    setProformaId(billableProformas[0]?.id ?? '')
    setInvoiceNumber('')
    setInvoiceType('A')
    setIssueDate(todayIso())
    setPdfFile(null)
    setPdfInvoice(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    else if (!proformaId && billableProformas[0]) setProformaId(billableProformas[0].id)
    onOpenChange(next)
  }

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Solo se permiten archivos PDF')
      return
    }
    setPdfFile(file)
    setPdfInvoice(null)
    void readInvoicePdf(file)
  }

  /** Lee la factura de ARCA: número, tipo, fecha e importes tal como los autorizó ARCA. */
  const readInvoicePdf = async (file: File) => {
    setPdfReading(true)
    try {
      const pages = await readPdfLines(file)
      if (!looksLikeArcaInvoice(pages)) {
        toast.info('No parece una factura de ARCA: se usa el IVA calculado sobre el neto.')
        return
      }
      const inv = parseArcaInvoice(pages)
      setPdfInvoice(inv)
      if (inv.invoiceNumber) setInvoiceNumber(inv.invoiceNumber)
      if (inv.invoiceType) setInvoiceType(inv.invoiceType)
      if (inv.issueDate) setIssueDate(inv.issueDate)
      if (inv.neto != null) {
        const candidates = billableProformas.filter((p) => roundCents(p.subtotal - inv.neto!) === 0)
        const byRef = candidates.find((p) => inv.proformaRefs.some((ref) => p.proformaNumber.startsWith(ref)))
        const pick = byRef ?? (candidates.length === 1 ? candidates[0] : null)
        if (pick) setProformaId(pick.id)
      }
      if (inv.errors.length > 0) toast.warning(inv.errors.join(' · '))
    } catch {
      toast.error('No se pudo leer el PDF de la factura')
    } finally {
      setPdfReading(false)
    }
  }

  const handleCreate = async () => {
    if (!proformaId || !invoiceNumber.trim() || !selectedProforma?.clientId) return

    setPending(true)
    try {
      const formData = new FormData()
      formData.set('proforma_id', proformaId)
      formData.set('invoice_number', invoiceNumber.trim())
      formData.set('invoice_type', invoiceType)
      formData.set('issue_date', issueDate)
      if (pdfAmounts) {
        formData.set('pdf_neto', String(pdfAmounts.subtotal))
        formData.set('pdf_iva', String(pdfAmounts.iva))
        formData.set('pdf_total', String(pdfAmounts.total))
        formData.set('pdf_lines', String(Math.max(1, pdfInvoice?.lines.length ?? 1)))
      }

      if (pdfFile) {
        const upload = await appendInvoiceFileToFormData(formData, selectedProforma.clientId, pdfFile)
        if (!upload.ok) {
          toast.error(upload.error)
          return
        }
      }

      const result = await createInvoice({}, formData)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.success)
      handleOpenChange(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      size="wide"
      title="Nueva factura"
      description="Subí el PDF de ARCA: se toman el número, la fecha y los importes de la factura."
      footer={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={
              pending ||
              pdfReading ||
              pdfBlocksSave ||
              !proformaId ||
              !invoiceNumber.trim() ||
              billableProformas.length === 0
            }
            onClick={handleCreate}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear factura
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {billableProformas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay proformas pendientes sin factura. Creá una proforma primero.
          </p>
        ) : (
          <>
            <Field>
              <FieldLabel>Proforma *</FieldLabel>
              <Select value={proformaId} onValueChange={setProformaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proforma" />
                </SelectTrigger>
                <SelectContent>
                  {billableProformas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.proformaNumber} — {p.clientName} ({formatCurrency(p.subtotal)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Nº factura *</FieldLabel>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ej. 0001-00001234"
                  disabled={pending}
                />
              </Field>
              <Field>
                <FieldLabel>Tipo</FieldLabel>
                <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as 'A' | 'B' | 'C')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Factura A</SelectItem>
                    <SelectItem value="B">Factura B</SelectItem>
                    <SelectItem value="C">Factura C</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel>Fecha de emisión *</FieldLabel>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} disabled={pending} />
            </Field>

            {pdfReading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Leyendo la factura…
              </p>
            )}
            {pdfBlocksSave && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {netoDiff !== 0
                  ? 'El neto de la factura no coincide con el de la proforma elegida. Revisá la proforma o la factura antes de guardar.'
                  : pdfInvoice?.errors.join(' · ')}
              </p>
            )}
            {amounts && (
              <div className="rounded-lg border bg-muted/30 divide-y text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">
                    {pdfAmounts ? 'Neto (factura ARCA)' : 'Neto (proforma)'}
                  </span>
                  <span className="font-medium tabular-nums">{formatCurrency(amounts.subtotal)}</span>
                </div>
                {pdfAmounts && selectedProforma && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Neto de la proforma</span>
                    <span
                      className={
                        netoDiff === 0
                          ? 'font-medium tabular-nums text-emerald-600'
                          : 'font-medium tabular-nums text-destructive'
                      }
                    >
                      {formatCurrency(selectedProforma.subtotal)}
                      {netoDiff === 0 ? ' ✓' : ` (dif. ${formatCurrency(netoDiff)})`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">
                    IVA ({INVOICE_IVA_RATE * 100}%){pdfAmounts ? ' según ARCA' : ' estimado'}
                  </span>
                  <span className="font-medium tabular-nums">{formatCurrency(amounts.iva)}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="font-medium">Total</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(amounts.total)}</span>
                </div>
              </div>
            )}

            <Field>
              <FieldLabel>PDF de la factura</FieldLabel>
              {pdfFile ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate flex-1">{pdfFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => {
                      setPdfFile(null)
                      setPdfInvoice(null)
                    }}
                    disabled={pending}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center hover:bg-muted/30 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Subir PDF de la factura</span>
                  <span className="text-xs text-muted-foreground">
                    Recomendado: se leen el número, la fecha y los importes
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={handlePdfChange}
                    disabled={pending}
                  />
                </label>
              )}
            </Field>
          </>
        )}
      </div>
    </FormSheet>
  )
}
