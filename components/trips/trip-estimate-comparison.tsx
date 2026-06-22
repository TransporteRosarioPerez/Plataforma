'use client'

import { Badge } from '@/components/ui/badge'
import { getTripEstimateComparison } from '@/lib/proformas/trip-estimate-amount'
import type { Trip } from '@/lib/types'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)

type TripEstimateComparisonProps = {
  trip: Trip
}

export function TripEstimateComparison({ trip }: TripEstimateComparisonProps) {
  const comparison = getTripEstimateComparison(trip)
  if (!comparison) return null

  const { estimatedUnit, estimatedTotal, proformaUnit, proformaTotal, totalsMatch, unitsMatch, pallets } =
    comparison

  const showComparison = estimatedTotal != null && proformaTotal != null
  if (!showComparison && estimatedTotal == null) return null

  const matches = totalsMatch === true && (unitsMatch === true || unitsMatch === null)

  return (
    <div className="rounded-md border p-3 space-y-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Estimado vs proforma</p>
        {showComparison && (
          <Badge
            variant="outline"
            className={
              matches
                ? 'bg-green-500/10 text-green-800 border-green-500/30'
                : 'bg-amber-500/10 text-amber-800 border-amber-500/30'
            }
          >
            {matches ? 'Estimativo correcto' : 'Diferencia vs estimado'}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Solo informativo. El ingreso aplicado al viaje es el de la proforma.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-medium" />
              <th className="py-1.5 px-2 text-right font-medium">Unitario/pallet</th>
              <th className="py-1.5 pl-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {estimatedTotal != null && (
              <tr className="border-b border-dashed">
                <td className="py-2 pr-2 text-muted-foreground">Estimado (viaje)</td>
                <td className="py-2 px-2 text-right">
                  {estimatedUnit != null ? formatCurrency(estimatedUnit) : '—'}
                </td>
                <td className="py-2 pl-2 text-right font-medium">{formatCurrency(estimatedTotal)}</td>
              </tr>
            )}
            {proformaTotal != null && (
              <tr>
                <td className="py-2 pr-2 text-muted-foreground">Real (proforma)</td>
                <td className="py-2 px-2 text-right">
                  {proformaUnit != null ? formatCurrency(proformaUnit) : '—'}
                </td>
                <td className="py-2 pl-2 text-right font-medium text-green-700">
                  {formatCurrency(proformaTotal)}
                </td>
              </tr>
            )}
            {showComparison && totalsMatch === false && estimatedTotal != null && proformaTotal != null && (
              <tr className="text-amber-800">
                <td className="py-2 pr-2">Diferencia</td>
                <td className="py-2 px-2 text-right">
                  {estimatedUnit != null && proformaUnit != null
                    ? formatCurrency(proformaUnit - estimatedUnit)
                    : '—'}
                </td>
                <td className="py-2 pl-2 text-right font-medium">
                  {formatCurrency(proformaTotal - estimatedTotal)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pallets != null && (
        <p className="text-xs text-muted-foreground">{pallets} pallets en el viaje</p>
      )}
    </div>
  )
}
