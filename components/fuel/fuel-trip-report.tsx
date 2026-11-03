'use client'

import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { FuelTripRow } from '@/lib/fuel/report'
import { formatArs, formatDate, formatLiters, formatPricePerLiter } from '@/components/fuel/format'

export function FuelTripReport({ rows }: { rows: FuelTripRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Ninguna carga del período está vinculada a un viaje.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Viaje</TableHead>
            <TableHead>Salida</TableHead>
            <TableHead>Unidades</TableHead>
            <TableHead>Chofer(es)</TableHead>
            <TableHead className="text-right">Cargas</TableHead>
            <TableHead className="text-right">Litros</TableHead>
            <TableHead className="text-right">Combustible $</TableHead>
            <TableHead className="text-right">Km del viaje</TableHead>
            <TableHead className="text-right">L / 100 km</TableHead>
            <TableHead className="text-right">$ por km</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.tripId}>
              <TableCell>
                <Link href={`/app/viajes/${r.tripId}`} className="font-mono text-sm text-primary hover:underline">
                  {r.code}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">{r.departureDate ? formatDate(r.departureDate) : '—'}</TableCell>
              <TableCell className="font-mono text-xs">{r.plates.join(', ')}</TableCell>
              <TableCell className="max-w-[180px] truncate text-sm" title={r.drivers.join(', ')}>
                {r.drivers.join(', ') || '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.loads}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatLiters(r.liters)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatArs(r.amount)}
                {r.pendingPriceLoads > 0 && (
                  <span className="block text-xs font-normal text-amber-700 dark:text-amber-400">
                    + {r.pendingPriceLoads} sin precio
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.km ? r.km.toLocaleString('es-AR') : '—'}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.litersPer100Km != null ? r.litersPer100Km.toLocaleString('es-AR') : '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.costPerKm != null ? formatPricePerLiter(r.costPerKm) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
