'use client'

import Link from 'next/link'
import { Fuel, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { FuelTransaction } from '@/lib/types'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type TripFuelSectionProps = {
  fuelTransactions: FuelTransaction[]
}

export function TripFuelSection({ fuelTransactions }: TripFuelSectionProps) {
  const total = fuelTransactions.reduce((sum, t) => sum + t.amountTotal, 0)
  const totalLiters = fuelTransactions.reduce((sum, t) => sum + t.liters, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-4 w-4" />
            Combustible importado
          </CardTitle>
          <CardDescription>
            Cargas vinculadas desde extractos YPF/Shell
            {fuelTransactions.length > 0 && (
              <> · {formatCurrency(total)} · {totalLiters.toLocaleString('es-AR', { maximumFractionDigits: 0 })} L</>
            )}
          </CardDescription>
        </div>
        <Link
          href="/app/combustible"
          className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          Ver módulo <ExternalLink className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {fuelTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay cargas de combustible importadas vinculadas a este viaje.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Patente</TableHead>
                  <TableHead>Estación</TableHead>
                  <TableHead className="text-right">Litros</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fuelTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {dateFormatter.format(t.transactionAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.provider.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{t.plate}</TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate" title={t.stationName}>
                      {t.stationName ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {t.liters > 0 ? t.liters.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(t.amountNet)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(t.amountTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
