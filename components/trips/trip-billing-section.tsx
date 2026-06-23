'use client'

import Link from 'next/link'
import { Receipt, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TripStatusBadge } from '@/components/trip-status-badge'
import { TripEconomicsSummary } from '@/components/trips/trip-economics-summary'
import { TripEstimateComparison } from '@/components/trips/trip-estimate-comparison'
import type { Trip, Proforma, Invoice } from '@/lib/types'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const proformaStatusLabels: Record<Proforma['status'], string> = {
  pendiente: 'Pendiente',
  facturada: 'Facturada',
  cobrada: 'Cobrada',
}

const invoiceStatusLabels: Record<Invoice['status'], string> = {
  emitida: 'Emitida',
  cobrada: 'Cobrada',
  anulada: 'Anulada',
}

type TripBillingSectionProps = {
  trip: Trip
  proformas: Proforma[]
  invoices: Invoice[]
}

export function TripBillingSection({ trip, proformas, invoices }: TripBillingSectionProps) {
  const isBillingStatus = trip.status === 'pending_payment' || trip.status === 'paid'
  const hasIncome = trip.totalIncome > 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Cobranza del viaje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Estado de cobro:</span>
            {isBillingStatus ? (
              <TripStatusBadge status={trip.status} size="sm" />
            ) : (
              <span className="text-muted-foreground">Operativo — sin proforma</span>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Los importes se cargan al crear la proforma en{' '}
            <Link href="/app/proformas" className="underline">Proformas</Link>.
            No hace falta facturar el viaje por separado.
          </p>

          {hasIncome && (
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Ingreso (desde proforma)</p>
                <p className="text-lg font-semibold tabular-nums text-green-700">
                  {formatCurrency(trip.totalIncome)}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Egresos del viaje</p>
                <p className="text-lg font-semibold tabular-nums text-red-700">
                  {formatCurrency(trip.totalExpenses)}
                </p>
              </div>
            </div>
          )}

          {hasIncome ? (
            <TripEconomicsSummary income={trip.totalIncome} expenses={trip.totalExpenses} />
          ) : (
            <p className="text-sm text-muted-foreground">
              El resultado económico se verá cuando el viaje esté incluido en una proforma con importe.
            </p>
          )}

          <TripEstimateComparison trip={trip} />

          <div className="flex flex-wrap gap-2">
            {!isBillingStatus && (
              <Button variant="secondary" asChild>
                <Link href="/app/proformas">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear proforma con este viaje
                </Link>
              </Button>
            )}
            {trip.status === 'pending_payment' && (
              <p className="text-xs text-muted-foreground w-full">
                Para registrar el cobro, marcá la factura como Cobrada en{' '}
                <Link href="/app/facturas" className="underline">Facturas</Link>.
              </p>
            )}
            {trip.status === 'paid' && (
              <p className="text-xs text-muted-foreground w-full">
                Este viaje fue cobrado al marcar la factura como Cobrada.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proformas vinculadas ({proformas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {proformas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin proformas. Incluí este viaje al crear una en Proformas.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {proformas.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <Link
                      href="/app/proformas"
                      className="font-mono font-medium hover:underline"
                    >
                      {p.proformaNumber}
                    </Link>
                    <span className="text-muted-foreground ml-2">{formatCurrency(p.total)}</span>
                  </div>
                  <Badge variant="outline">{proformaStatusLabels[p.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Button variant="link" className="px-0 mt-2" asChild>
            <Link href="/app/proformas">Ver todas las proformas</Link>
          </Button>
        </CardContent>
      </Card>

      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Facturas ({invoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <Link href="/app/facturas" className="font-mono font-medium hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                    <span className="text-muted-foreground ml-2">
                      Neto {formatCurrency(inv.subtotal)} + IVA {formatCurrency(inv.iva)}
                    </span>
                  </div>
                  <Badge variant="outline">{invoiceStatusLabels[inv.status]}</Badge>
                </li>
              ))}
            </ul>
            <Button variant="link" className="px-0 mt-2" asChild>
              <Link href="/app/facturas">Ver facturas</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
