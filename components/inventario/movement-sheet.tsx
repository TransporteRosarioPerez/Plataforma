'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/components/ui/form-sheet'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createInventoryMovement } from '@/lib/actions/inventory-movements'
import type { InventoryItem, InventoryMovementType } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const initialState: ActionState = {}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

type MovementSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: InventoryItem[]
  defaultItemId?: string
  defaultType?: InventoryMovementType
}

export function MovementSheet({
  open,
  onOpenChange,
  items,
  defaultItemId,
  defaultType = 'purchase',
}: MovementSheetProps) {
  const router = useRouter()
  const activeItems = items.filter((i) => i.isActive)

  const [movementType, setMovementType] = useState<InventoryMovementType>(defaultType)
  const [itemId, setItemId] = useState(defaultItemId ?? '')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>('increase')

  const [state, formAction, pending] = useActionState(createInventoryMovement, initialState)

  useEffect(() => {
    if (!open) return
    setMovementType(defaultType)
    setItemId(defaultItemId ?? activeItems[0]?.id ?? '')
    setQuantity('1')
    setUnitCost('')
    setAdjustmentDirection('increase')
  }, [open, defaultItemId, defaultType, activeItems])

  const totalCost = useMemo(() => {
    const q = Number(quantity) || 0
    const cost = Number(unitCost) || 0
    return q * cost
  }, [quantity, unitCost])

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
      onOpenChange(false)
      router.refresh()
    }
    if (state.error) toast.error(state.error)
  }, [state, onOpenChange, router])

  const selectedItem = activeItems.find((i) => i.id === itemId)

  const title =
    movementType === 'purchase'
      ? 'Registrar compra'
      : movementType === 'consumption'
        ? 'Registrar consumo'
        : 'Ajuste de stock'

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="default"
      title={title}
      footer={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="inventory-movement-form" className="flex-1" disabled={pending || !itemId}>
            Guardar
          </Button>
        </div>
      }
    >
      <form id="inventory-movement-form" action={formAction} className="space-y-4">
        <input type="hidden" name="movement_type" value={movementType} />
        <input type="hidden" name="item_id" value={itemId} />
        {movementType === 'adjustment' && (
          <input type="hidden" name="adjustment_direction" value={adjustmentDirection} />
        )}

        <Field>
          <FieldLabel>Tipo</FieldLabel>
          <Select
            value={movementType}
            onValueChange={(v) => setMovementType(v as InventoryMovementType)}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="purchase">Compra (entrada + costo)</SelectItem>
              <SelectItem value="consumption">Consumo (salida)</SelectItem>
              <SelectItem value="adjustment">Ajuste manual</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Ítem *</FieldLabel>
          <Select value={itemId} onValueChange={setItemId} disabled={pending || !!defaultItemId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar ítem" />
            </SelectTrigger>
            <SelectContent>
              {activeItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} ({item.currentQuantity} {item.unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedItem && (
            <p className="text-xs text-muted-foreground mt-1">
              Stock actual: {selectedItem.currentQuantity} {selectedItem.unit}
            </p>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Cantidad *</FieldLabel>
            <Input
              name="quantity"
              type="number"
              min={0.01}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              disabled={pending}
            />
          </Field>
          <Field>
            <FieldLabel>Fecha *</FieldLabel>
            <Input
              name="movement_date"
              type="date"
              defaultValue={todayIso()}
              required
              disabled={pending}
            />
          </Field>
        </div>

        {movementType === 'purchase' && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Costo unitario *</FieldLabel>
                <Input
                  name="unit_cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  required
                  disabled={pending}
                />
              </Field>
              <Field>
                <FieldLabel>Total</FieldLabel>
                <Input type="text" value={formatCurrency(totalCost)} readOnly className="bg-muted" />
              </Field>
            </div>
            <Field>
              <FieldLabel>Proveedor</FieldLabel>
              <Input name="supplier_name" disabled={pending} />
            </Field>
            <Field>
              <FieldLabel>Nº factura / remito</FieldLabel>
              <Input name="invoice_reference" disabled={pending} />
            </Field>
          </>
        )}

        {movementType === 'adjustment' && (
          <Field>
            <FieldLabel>Dirección *</FieldLabel>
            <Select
              value={adjustmentDirection}
              onValueChange={(v) => setAdjustmentDirection(v as 'increase' | 'decrease')}
              disabled={pending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="increase">Sumar al stock</SelectItem>
                <SelectItem value="decrease">Restar del stock</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field>
          <FieldLabel>{movementType === 'adjustment' ? 'Motivo *' : 'Notas'}</FieldLabel>
          <Textarea
            name="notes"
            rows={2}
            required={movementType === 'adjustment'}
            disabled={pending}
            placeholder={
              movementType === 'consumption' ? 'Ej: asignado a unidad ABC123' : undefined
            }
          />
        </Field>
      </form>
    </FormSheet>
  )
}

export const MovementDialog = MovementSheet
