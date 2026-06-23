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

  const selectedProforma = useMemo(
    () => billableProformas.find((p) => p.id === proformaId) ?? null,
    [billableProformas, proformaId]
  )

  const amounts = useMemo(
    () => (selectedProforma ? calculateInvoiceAmounts(selectedProforma.subtotal) : null),
    [selectedProforma]
  )

  const resetForm = () => {
    setProformaId(billableProformas[0]?.id ?? '')
    setInvoiceNumber('')
    setInvoiceType('A')
    setIssueDate(todayIso())
    setPdfFile(null)
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
      description="Vinculá una proforma pendiente. El IVA 21% se calcula sobre el neto total."
      footer={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={pending || !proformaId || !invoiceNumber.trim() || billableProformas.length === 0}
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

            {amounts && (
              <div className="rounded-lg border bg-muted/30 divide-y text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Neto (proforma)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(amounts.subtotal)}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">IVA ({INVOICE_IVA_RATE * 100}%)</span>
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
                    onClick={() => setPdfFile(null)}
                    disabled={pending}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center hover:bg-muted/30 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Subir PDF de la factura</span>
                  <span className="text-xs text-muted-foreground">Opcional · solo PDF</span>
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
