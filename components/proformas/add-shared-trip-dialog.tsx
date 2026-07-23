'use client'

import { useState } from 'react'
import { Loader2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  findSharedTripForProforma,
  type SharedTripLookup,
} from '@/lib/actions/proformas'
import { toast } from 'sonner'

type AddSharedTripDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  excludeProformaId?: string
  excludeTripIds: string[]
  onConfirm: (trip: SharedTripLookup) => void
}

export function AddSharedTripDialog({
  open,
  onOpenChange,
  excludeProformaId,
  excludeTripIds,
  onConfirm,
}: AddSharedTripDialogProps) {
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<SharedTripLookup | null>(null)

  const reset = () => {
    setCode('')
    setResult(null)
    setPending(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSearch = async () => {
    setPending(true)
    setResult(null)
    try {
      const lookup = await findSharedTripForProforma(code, {
        excludeProformaId,
        excludeTripIds,
      })
      if (lookup.error || !lookup.trip) {
        toast.error(lookup.error ?? 'No se encontró el viaje')
        return
      }
      setResult(lookup.trip)
    } finally {
      setPending(false)
    }
  }

  const handleConfirm = () => {
    if (!result) return
    onConfirm(result)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar viaje compartido</DialogTitle>
          <DialogDescription>
            Para el caso excepcional en que un mismo viaje se factura a más de un cliente. Buscá
            por nº de viaje; debe estar ya en otra proforma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel>Nº de viaje</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej. V-1234"
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleSearch()
                  }
                }}
              />
              <Button type="button" variant="secondary" disabled={pending || !code.trim()} onClick={() => void handleSearch()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
              </Button>
            </div>
          </Field>

          {result && (
            <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Share2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{result.code}</span>
              </div>
              <p className="text-muted-foreground">
                {result.origin}
                {result.destination ? ` → ${result.destination}` : ''}
              </p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Ya incluido en:</p>
                <ul className="space-y-1">
                  {result.existingProformas.map((p) => (
                    <li key={p.id} className="text-xs">
                      <span className="font-mono">{p.proformaNumber}</span>
                      {' · '}
                      {p.clientName}
                      {' · '}
                      {p.status}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-amber-800">
                El ingreso del viaje será la suma de los importes de todas las proformas. Quedará
                pagado recién cuando todas estén cobradas.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!result} onClick={handleConfirm}>
            Agregar a esta proforma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
