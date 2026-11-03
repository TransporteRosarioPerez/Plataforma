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

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

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
  canViewInvoices?: boolean
}

export function TripBillingSection({
  trip,
  proformas,
  invoices,
  canViewInvoices = false,
}: TripBillingSectionProps) {
  const isBillingStatus = trip.status === 'pending_payment' || trip.status === 'paid'
  const hasIncome = trip.totalIncome > 0

  // Línea de este viaje en cada proforma (importe original o ajuste)
  const tripLines = proformas
    .map((p) => {
      const line = p.lineItems.find((l) => l.tripId === trip.id)
      return line ? { proforma: p, line } : null
    })
    .filter((x): x is { proforma: Proforma; line: Proforma['lineItems'][number] } => !!x)
    .sort((a, b) => a.proforma.receivedDate.getTime() - b.proforma.receivedDate.getTime())
  const lineByProformaId = new Map(tripLines.map((x) => [x.proforma.id, x.line]))
  const adjustments = tripLines.filter((x) => x.line.isAdjustment)
  const legacyIncome = trip.legacyBillingStatus ? trip.legacyIncome ?? 0 : 0
  const originalIncome =
    legacyIncome +
    tripLines.filter((x) => !x.line.isAdjustment).reduce((sum, x) => sum + x.line.amount, 0)
  const adjustmentsTotal = adjustments.reduce((sum, x) => sum + x.line.amount, 0)

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

          {adjustments.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3 space-y-2 text-sm">
              <p className="font-medium">
                Viaje ajustado ({adjustments.length} ajuste{adjustments.length === 1 ? '' : 's'})
              </p>
              <ul className="space-y-1 text-xs">
                <li className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    Importe original{trip.legacyBillingStatus ? ' (sistema anterior)' : ''}
                  </span>
                  <span className="tabular-nums">{formatCurrency(originalIncome)}</span>
                </li>
                {adjustments.map(({ proforma, line }) => (
                  <li key={proforma.id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground min-w-0 truncate">
                      Ajuste {dateFormatter.format(proforma.receivedDate)} ·{' '}
                      <span className="font-mono">{proforma.proformaNumber}</span>
                      {line.adjustmentReason ? ` · ${line.adjustmentReason}` : ''}
                    </span>
                    <span
                      className={`tabular-nums shrink-0 ${line.amount >= 0 ? 'text-green-700' : 'text-red-700'}`}
                    >
                      {line.amount >= 0 ? '+' : '−'}
                      {formatCurrency(Math.abs(line.amount))}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between gap-2 border-t pt-1 font-medium">
                  <span>Ingreso total</span>
                  <span className="tabular-nums">{formatCurrency(originalIncome + adjustmentsTotal)}</span>
                </li>
              </ul>
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
                {canViewInvoices ? (
                  <>
                    Para registrar el cobro, marcá la factura como Cobrada en{' '}
                    <Link href="/app/facturas" className="underline">Facturas</Link>.
                  </>
                ) : (
                  'Para registrar el cobro, contactá al administrador para marcar la factura como cobrada.'
                )}
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
              {proformas.map((p) => {
                const line = lineByProformaId.get(p.id)
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href="/app/proformas"
                        className="font-mono font-medium hover:underline"
                      >
                        {p.proformaNumber}
                      </Link>
                      {line?.isAdjustment && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500/40 text-amber-800 bg-amber-500/10"
                        >
                          Ajuste
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        {line ? (
                          <>
                            Este viaje {formatCurrency(line.amount)}
                            {p.tripIds.length > 1 && ` · total ${formatCurrency(p.total)}`}
                          </>
                        ) : (
                          formatCurrency(p.total)
                        )}
                      </span>
                    </div>
                    <Badge variant="outline">{proformaStatusLabels[p.status]}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
          <Button variant="link" className="px-0 mt-2" asChild>
            <Link href="/app/proformas">Ver todas las proformas</Link>
          </Button>
        </CardContent>
      </Card>

      {canViewInvoices && invoices.length > 0 && (
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
