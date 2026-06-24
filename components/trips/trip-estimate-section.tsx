'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NumberInput } from '@/components/ui/number-input'
import { Field, FieldLabel } from '@/components/ui/field'
import { updateTripEstimate } from '@/lib/actions/trips'
import { getTripEstimatedAmount } from '@/lib/proformas/trip-estimate-amount'
import type { Trip } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const initialState: ActionState = {}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)

type TripEstimateSectionProps = {
  trip: Trip
  readOnly?: boolean
}

export function TripEstimateSection({ trip, readOnly }: TripEstimateSectionProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateTripEstimate, initialState)
  const estimatedTotal = getTripEstimatedAmount(trip)

  const [unitPrice, setUnitPrice] = useState<number | undefined>(trip.unitPrice ?? undefined)
  const [pallets, setPallets] = useState<number | undefined>(trip.totalPallets ?? undefined)

  useEffect(() => {
    if (state.error) toast.error(state.error)
    if (state.success) {
      toast.success(state.success)
      router.refresh()
    }
  }, [state, router])

  if (readOnly && trip.unitPrice == null && !trip.totalPallets) return null

  if (readOnly) {
    return (
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Estimado al cargar viaje</p>
        {trip.unitPrice != null && trip.totalPallets != null ? (
          <p>
            {formatCurrency(trip.unitPrice)}/pallet × {trip.totalPallets} pallets ={' '}
            <span className="font-medium tabular-nums">
              {estimatedTotal != null ? formatCurrency(estimatedTotal) : '—'}
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">
            {trip.unitPrice != null && `Precio/pallet: ${formatCurrency(trip.unitPrice)}`}
            {trip.totalPallets != null && ` · Pallets: ${trip.totalPallets}`}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Referencia para comparar con la proforma. No afecta el resultado económico.
        </p>
      </div>
    )
  }

  return (
    <CardEstimateForm
      tripId={trip.id}
      unitPrice={unitPrice}
      pallets={pallets}
      onUnitPriceChange={setUnitPrice}
      onPalletsChange={setPallets}
      formAction={formAction}
      pending={pending}
      estimatedPreview={
        unitPrice != null && pallets != null && unitPrice > 0 && pallets > 0
          ? unitPrice * pallets
          : null
      }
    />
  )
}

function CardEstimateForm({
  tripId,
  unitPrice,
  pallets,
  onUnitPriceChange,
  onPalletsChange,
  formAction,
  pending,
  estimatedPreview,
}: {
  tripId: string
  unitPrice: number | undefined
  pallets: number | undefined
  onUnitPriceChange: (v: number | undefined) => void
  onPalletsChange: (v: number | undefined) => void
  formAction: (payload: FormData) => void
  pending: boolean
  estimatedPreview: number | null
}) {
  return (
    <form action={formAction} className="rounded-md border p-3 space-y-3">
      <div>
        <p className="text-sm font-medium">Precio estimado (por pallet)</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Estimativo al cargar el viaje. El importe real se confirma al recibir la proforma.
        </p>
      </div>
      <input type="hidden" name="trip_id" value={tripId} />
      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel className="text-xs">Precio/pallet</FieldLabel>
          <NumberInput
            name="unit_price"
            min={0}
            decimals={2}
            value={unitPrice}
            onValueChange={onUnitPriceChange}
            disabled={pending}
            placeholder="Opcional"
          />
        </Field>
        <Field>
          <FieldLabel className="text-xs">Pallets</FieldLabel>
          <NumberInput
            name="total_pallets"
            min={1}
            decimals={0}
            value={pallets}
            onValueChange={onPalletsChange}
            disabled={pending}
            placeholder="Opcional"
          />
        </Field>
      </div>
      {estimatedPreview != null && (
        <p className="text-xs text-muted-foreground">
          Total estimado:{' '}
          <span className="font-medium text-foreground tabular-nums">
            {formatCurrency(estimatedPreview)}
          </span>
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        Guardar estimado
      </Button>
    </form>
  )
}
