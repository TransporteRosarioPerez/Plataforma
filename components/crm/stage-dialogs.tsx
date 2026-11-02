'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LOST_REASONS, STAGE_LABELS } from '@/lib/crm/constants'
import type { CrmQuote, CrmStage } from '@/lib/crm/types'
import { formatMoney } from './shared'

export type StageRequest = { quote: CrmQuote; stage: CrmStage; position: number } | null

/** Pide lo que falta para cambiar de etapa: precio (enviada/negociación/ganada) o motivo (perdida). */
export function StageDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: StageRequest
  onCancel: () => void
  onConfirm: (extra: { quotedAmount?: number; lostReason?: string; lostNotes?: string }) => void
}) {
  const [amount, setAmount] = useState<number | undefined>()
  const [reason, setReason] = useState<string>('')
  const [notes, setNotes] = useState('')
  useEffect(() => {
    setAmount(request?.quote.quotedAmount ?? request?.quote.suggestedAmount ?? undefined)
    setReason('')
    setNotes('')
  }, [request])
  if (!request) return null
  const lost = request.stage === 'perdida'
  const ok = lost ? !!reason : !!amount && amount > 0
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lost ? '¿Por qué se perdió?' : `Pasar a ${STAGE_LABELS[request.stage]}`}</DialogTitle>
          <DialogDescription>
            {request.quote.companyName}
            {request.quote.destination ? ` · ${request.quote.destination}` : ''}
          </DialogDescription>
        </DialogHeader>
        {lost ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Elegí un motivo" /></SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lost-notes">Detalle (opcional)</Label>
              <Textarea id="lost-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: otro transporte cotizó 15% menos" />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="quoted-amount">Precio cotizado (sin IVA)</Label>
            <NumberInput id="quoted-amount" value={amount ?? ''} onValueChange={setAmount} autoFocus />
            {request.quote.suggestedAmount ? (
              <p className="text-xs text-muted-foreground">Sugerido por tarifario: {formatMoney(request.quote.suggestedAmount)}</p>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            disabled={!ok}
            onClick={() => onConfirm(lost ? { lostReason: reason, lostNotes: notes } : { quotedAmount: amount })}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function needsExtra(quote: CrmQuote, stage: CrmStage): boolean {
  if (stage === quote.stage) return false
  if (stage === 'perdida') return true
  if ((stage === 'enviada' || stage === 'negociacion' || stage === 'ganada') && !quote.quotedAmount) return true
  return false
}
