'use client'

import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { share, type FuelSummary, type FuelVehicleRow } from '@/lib/fuel/report'
import { ShareCell } from '@/components/fuel/share-cell'
import { formatArs, formatLiters, formatPricePerLiter } from '@/components/fuel/format'

type FuelVehicleReportProps = {
  rows: FuelVehicleRow[]
  total: FuelSummary
  emptyText?: string
}

export function FuelVehicleReport({ rows, total, emptyText = 'No hay cargas en este período.' }: FuelVehicleReportProps) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  }

  const showConsumption = rows.some((r) => r.consumption)

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patente</TableHead>
            <TableHead>Chofer(es)</TableHead>
            <TableHead className="text-right">Cargas</TableHead>
            <TableHead className="text-right">Litros</TableHead>
            <TableHead className="text-right">Total $</TableHead>
            <TableHead className="text-right">% del gasto</TableHead>
            <TableHead className="text-right">$ / litro prom.</TableHead>
            <TableHead className="text-right">Sin precio</TableHead>
            {showConsumption && <TableHead className="text-right">L / 100 km</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell className="whitespace-nowrap">
                <span className="font-mono text-sm">{r.plate}</span>
                {(r.vehicleType === 'semi' || r.vehicleType === 'trailer') && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">Térmico</Badge>
                )}
                {!r.vehicleId && (
                  <Badge variant="outline" className="ml-2 text-[10px]">fuera de flota</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-sm" title={r.drivers.join(', ')}>
                {r.drivers.join(', ') || '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.loads}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatLiters(r.liters)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatArs(r.amount)}</TableCell>
              <TableCell>
                <ShareCell value={share(r.amount, total.amount)} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.avgPricePerLiter != null ? formatPricePerLiter(r.avgPricePerLiter) : '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.pendingPriceLoads > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400" title={`≈ ${formatArs(r.estimatedPendingAmount)} al precio promedio`}>
                    {r.pendingPriceLoads} ({formatLiters(r.pendingPriceLiters)})
                  </span>
                ) : (
                  '—'
                )}
              </TableCell>
              {showConsumption && (
                <TableCell className="text-right tabular-nums" title={r.consumption ? `${r.consumption.km.toLocaleString('es-AR')} km` : undefined}>
                  {r.consumption ? r.consumption.litersPer100Km.toLocaleString('es-AR') : '—'}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-semibold">Total</TableCell>
            <TableCell className="text-right tabular-nums">{total.loads}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatLiters(total.liters)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatArs(total.amount)}</TableCell>
            <TableCell className="text-right tabular-nums">100%</TableCell>
            <TableCell className="text-right tabular-nums">
              {total.avgPricePerLiter != null ? formatPricePerLiter(total.avgPricePerLiter) : '—'}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {total.pendingPriceLoads > 0 ? `${total.pendingPriceLoads} (${formatLiters(total.pendingPriceLiters)})` : '—'}
            </TableCell>
            {showConsumption && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
