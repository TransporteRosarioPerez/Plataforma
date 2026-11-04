'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, FileSearch } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PdfRowState, ProformaPdfReview } from '@/lib/proformas/pdf-review'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n)

const stateLabel: Record<PdfRowState, string> = {
  ok: 'OK',
  amount_diff: 'Importe distinto',
  missing_trip: 'Sin viaje',
  not_in_proforma: 'Falta en la proforma',
  not_billable: 'No facturable',
}

type Props = {
  proformaNumber: string
  review: ProformaPdfReview
  reviewed: boolean
  onReviewedChange: (value: boolean) => void
  disabled?: boolean
  /** Muestra el precio esperado de cada viaje en la plataforma (precio unitario × pallets). */
  showEstimates?: boolean
}

/** Control de la proforma contra el PDF: hay que tildarlo para poder guardar. */
export function ProformaPdfCheck({
  proformaNumber,
  review,
  reviewed,
  onReviewedChange,
  disabled,
  showEstimates,
}: Props) {
  const [showRows, setShowRows] = useState(!review.ok)
  const okRows = review.rows.filter((r) => r.state === 'ok').length

  return (
    <div
      className={cn(
        'rounded-lg border text-sm',
        review.ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-destructive/40 bg-destructive/5'
      )}
    >
      <div className="flex items-start gap-2 px-4 py-3">
        {review.ok ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}
        <div className="flex-1 space-y-1">
          <p className="font-medium">
            {review.ok ? 'Coincide con el PDF' : 'No coincide con el PDF'} · proforma {proformaNumber}
          </p>
          <div className="grid grid-cols-3 gap-2 tabular-nums">
            <div>
              <p className="text-xs text-muted-foreground">PDF</p>
              <p className="font-medium">{fmt(review.pdfTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Proforma</p>
              <p className="font-medium">{fmt(review.linesTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Diferencia</p>
              <p className={cn('font-medium', review.diff !== 0 && 'text-destructive')}>{fmt(review.diff)}</p>
            </div>
          </div>
          {review.problems.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-destructive">
              {review.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t px-4 py-2">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Totales por corte</p>
        <div className="space-y-0.5 tabular-nums">
          {review.cortes.map((c) => (
            <div key={c.corte} className="flex items-center justify-between gap-2">
              <span>Corte {c.corte}</span>
              <span className={cn(!c.ok && 'text-destructive')}>
                {fmt(c.linesTotal)} / {c.printedTotal == null ? 'sin TOTALES' : fmt(c.printedTotal)}
                {c.ok ? ' ✓' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-medium text-muted-foreground"
          onClick={() => setShowRows((v) => !v)}
        >
          <span className="flex items-center gap-1.5">
            <FileSearch className="h-3.5 w-3.5" />
            Viajes del PDF: {okRows} de {review.rows.length} OK
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showRows && 'rotate-180')} />
        </button>
        {showRows && (
          <div className="max-h-72 overflow-y-auto px-4 pb-2">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="py-1 font-normal">Carga</th>
                  <th className="py-1 font-normal">Fecha</th>
                  <th className="py-1 text-right font-normal">PDF</th>
                  <th className="py-1 text-right font-normal">Proforma</th>
                  {showEstimates && <th className="py-1 text-right font-normal">Esperado</th>}
                  <th className="py-1 pl-2 font-normal">Estado</th>
                </tr>
              </thead>
              <tbody>
                {review.rows.map((r, i) => (
                  <tr key={`${r.row.code}-${i}`} className="border-t border-border/50">
                    <td className="py-1">{r.row.code}</td>
                    <td className="py-1">{r.row.date.split('-').reverse().join('/')}</td>
                    <td className="py-1 text-right">{fmt(r.row.amount)}</td>
                    <td className="py-1 text-right">{r.lineAmount == null ? '—' : fmt(r.lineAmount)}</td>
                    {showEstimates && (
                      <td
                        className={cn(
                          'py-1 text-right',
                          r.match?.estimate != null &&
                            Math.abs(r.match.estimate - r.row.amount) >= 0.01 &&
                            'text-amber-600'
                        )}
                        title="Precio unitario × pallets cargados en el viaje"
                      >
                        {r.match?.estimate == null ? '—' : fmt(r.match.estimate)}
                      </td>
                    )}
                    <td className="py-1 pl-2">
                      <Badge variant={r.state === 'ok' ? 'secondary' : 'destructive'} className="text-[10px]">
                        {stateLabel[r.state]}
                      </Badge>
                      {r.match?.kind === 'adjustment' && r.state === 'ok' && (
                        <Badge variant="outline" className="ml-1 text-[10px]">Ajuste</Badge>
                      )}
                      {r.match?.kind === 'shared' && r.state === 'ok' && (
                        <Badge variant="outline" className="ml-1 text-[10px]">Compartido</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <label
        className={cn(
          'flex items-center gap-2 border-t px-4 py-3',
          review.ok ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
        )}
      >
        <Checkbox
          checked={reviewed && review.ok}
          onCheckedChange={(v) => onReviewedChange(v === true)}
          disabled={disabled || !review.ok}
        />
        <span>Revisé que los viajes y el total coinciden con el PDF</span>
      </label>
    </div>
  )
}
