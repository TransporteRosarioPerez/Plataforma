'use client'

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { share, type FuelDriverRow, type FuelSummary } from '@/lib/fuel/report'
import { ShareCell } from '@/components/fuel/share-cell'
import { formatArs, formatLiters, formatPricePerLiter } from '@/components/fuel/format'

type FuelDriverReportProps = {
  rows: FuelDriverRow[]
  total: FuelSummary
}

export function FuelDriverReport({ rows, total }: FuelDriverReportProps) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No hay cargas en este período.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chofer</TableHead>
            <TableHead>Unidades</TableHead>
            <TableHead className="text-right">Cargas</TableHead>
            <TableHead className="text-right">Litros</TableHead>
            <TableHead className="text-right">Litros por carga</TableHead>
            <TableHead className="text-right">Total $</TableHead>
            <TableHead className="text-right">% del gasto</TableHead>
            <TableHead className="text-right">$ / litro prom.</TableHead>
            <TableHead className="text-right">Sin precio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell className={r.driverId ? 'font-medium' : 'text-muted-foreground'}>{r.name}</TableCell>
              <TableCell className="max-w-[200px] truncate font-mono text-xs" title={r.plates.join(', ')}>
                {r.plates.join(', ')}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.loads}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatLiters(r.liters)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatLiters(r.liters / r.loads)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatArs(r.amount)}</TableCell>
              <TableCell>
                <ShareCell value={share(r.amount, total.amount)} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.avgPricePerLiter != null ? formatPricePerLiter(r.avgPricePerLiter) : '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.pendingPriceLoads > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    {r.pendingPriceLoads} ({formatLiters(r.pendingPriceLiters)})
                  </span>
                ) : (
                  '—'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-semibold">Total</TableCell>
            <TableCell className="text-right tabular-nums">{total.loads}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatLiters(total.liters)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {total.loads > 0 ? formatLiters(total.liters / total.loads) : '—'}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatArs(total.amount)}</TableCell>
            <TableCell className="text-right tabular-nums">100%</TableCell>
            <TableCell className="text-right tabular-nums">
              {total.avgPricePerLiter != null ? formatPricePerLiter(total.avgPricePerLiter) : '—'}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {total.pendingPriceLoads > 0 ? `${total.pendingPriceLoads} (${formatLiters(total.pendingPriceLiters)})` : '—'}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
