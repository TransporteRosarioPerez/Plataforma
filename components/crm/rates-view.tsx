'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PALLETS_PER_SEMI } from '@/lib/crm/constants'
import { PROVINCES } from '@/lib/crm/places'
import { upsertRate } from '@/lib/crm/server/actions-companies'
import type { CrmRate } from '@/lib/crm/types'
import { formatMoney, useAction } from './shared'

export function RatesView({ rates }: { rates: CrmRate[] }) {
  const missing = PROVINCES.filter((p) => !rates.some((r) => r.province === p))
  const [adding, setAdding] = useState<string>('')
  const { pending, run } = useAction()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tarifario de referencia (origen Buenos Aires, sin IVA)</CardTitle>
        <CardDescription>
          Sirve para sugerir el precio en cada cotización: carga parcial = pallets × precio por pallet (con tope en el semi completo);
          semi completo ({PALLETS_PER_SEMI} pallets) = precio del semi. El recargo de congelado se suma sobre la tarifa. Siempre se puede cambiar a mano.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destino</TableHead>
              <TableHead>Por pallet</TableHead>
              <TableHead>Semi completo</TableHead>
              <TableHead>Recargo congelado %</TableHead>
              <TableHead className="hidden md:table-cell">Notas</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((r) => <RateRow key={`${r.id}-${r.pricePerPallet}-${r.priceFullTruck}-${r.frozenSurchargePct}-${r.isActive}`} rate={r} />)}
          </TableBody>
        </Table>
        {missing.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
            <Select value={adding} onValueChange={setAdding}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Agregar provincia…" /></SelectTrigger>
              <SelectContent>{missing.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={pending || !adding}
              onClick={() => run(() => upsertRate({ province: adding, pricePerPallet: null, priceFullTruck: null, frozenSurchargePct: 0, notes: null, isActive: true }), () => setAdding(''))}
            >
              <Plus className="mr-1 h-4 w-4" />Agregar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RateRow({ rate }: { rate: CrmRate }) {
  const [perPallet, setPerPallet] = useState<number | undefined>(rate.pricePerPallet ?? undefined)
  const [full, setFull] = useState<number | undefined>(rate.priceFullTruck ?? undefined)
  const [pct, setPct] = useState<number | undefined>(rate.frozenSurchargePct || undefined)
  const [notes, setNotes] = useState(rate.notes ?? '')
  const [active, setActive] = useState(rate.isActive)
  const { pending, run } = useAction()
  const dirty =
    (perPallet ?? null) !== rate.pricePerPallet ||
    (full ?? null) !== rate.priceFullTruck ||
    (pct ?? 0) !== rate.frozenSurchargePct ||
    notes !== (rate.notes ?? '') ||
    active !== rate.isActive
  const implied = perPallet ? perPallet * PALLETS_PER_SEMI : null
  return (
    <TableRow>
      <TableCell className="font-medium">{rate.province}</TableCell>
      <TableCell><NumberInput className="w-32" value={perPallet ?? ''} onValueChange={setPerPallet} /></TableCell>
      <TableCell>
        <NumberInput className="w-36" value={full ?? ''} onValueChange={setFull} />
        {!full && implied ? <p className="mt-0.5 text-xs text-muted-foreground">{PALLETS_PER_SEMI} × pallet = {formatMoney(implied)}</p> : null}
      </TableCell>
      <TableCell><NumberInput className="w-20" value={pct ?? ''} onValueChange={setPct} /></TableCell>
      <TableCell className="hidden md:table-cell"><Input className="w-48" value={notes} onChange={(e) => setNotes(e.target.value)} /></TableCell>
      <TableCell><Switch checked={active} onCheckedChange={setActive} /></TableCell>
      <TableCell>
        <Button
          size="sm"
          variant={dirty ? 'default' : 'ghost'}
          disabled={pending || !dirty}
          onClick={() =>
            run(() =>
              upsertRate({
                id: rate.id,
                province: rate.province,
                pricePerPallet: perPallet ?? null,
                priceFullTruck: full ?? null,
                frozenSurchargePct: pct ?? 0,
                notes: notes || null,
                isActive: active,
              }),
            )
          }
        >
          Guardar
        </Button>
      </TableCell>
    </TableRow>
  )
}
