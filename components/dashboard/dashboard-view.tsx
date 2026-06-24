import Link from 'next/link'
import {
  Truck, Route, FileWarning, DollarSign, Plus, ArrowRight, Building2, UserCircle, BarChart3, Package,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { DashboardSentTrip, DashboardStats } from '@/lib/data/dashboard'
import { INVENTORY_ENABLED } from '@/lib/features'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

type DashboardViewProps = {
  stats: DashboardStats
  sentTrips: DashboardSentTrip[]
  canViewReports?: boolean
}

export function DashboardView({ stats, sentTrips, canViewReports = false }: DashboardViewProps) {
  const operationalKpis = [
    {
      title: 'Viajes registrados',
      value: stats.tripsCount.toString(),
      description: stats.sentTripsCount > 0
        ? `${stats.sentTripsCount} enviados`
        : 'Operación y facturación',
      icon: Route,
      href: '/app/viajes',
      color: 'text-primary',
    },
    {
      title: 'Clientes facturación',
      value: stats.clientsCount.toString(),
      description: 'Cartera activa',
      icon: Building2,
      href: '/app/clientes',
      color: 'text-primary',
    },
    {
      title: 'Flota',
      value: stats.vehiclesCount.toString(),
      description: 'Vehículos',
      icon: Truck,
      href: '/app/flota',
      color: 'text-primary',
    },
    {
      title: 'Vencimientos',
      value: stats.expiringDocuments.toString(),
      description: 'Vencidos o próximos',
      icon: FileWarning,
      href: '/app/documentos',
      color: stats.expiringDocuments > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
    {
      title: 'Proformas pendientes',
      value: formatCurrency(stats.pendingAmount),
      description: `${stats.pendingProformas} proformas`,
      icon: DollarSign,
      href: '/app/proformas',
      color: 'text-primary',
    },
    ...(INVENTORY_ENABLED
      ? [{
          title: 'Stock bajo',
          value: stats.lowStockItems.toString(),
          description: 'Ítems de inventario',
          icon: Package,
          href: '/app/inventario',
          color: stats.lowStockItems > 0 ? 'text-amber-600' : 'text-muted-foreground',
        }]
      : []),
    {
      title: 'Choferes',
      value: stats.driversCount.toString(),
      description: 'Conductores',
      icon: UserCircle,
      href: '/app/choferes',
      color: 'text-primary',
    },
  ]

  const quickActions = [
    { label: 'Nuevo viaje', href: '/app/viajes', icon: Plus },
    { label: 'Agregar cliente', href: '/app/clientes', icon: Building2 },
    ...(canViewReports
      ? [{ label: 'Ver reportes', href: '/app/reportes', icon: BarChart3 }]
      : []),
    { label: 'Ver flota', href: '/app/flota', icon: Truck },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Resumen operativo de tu empresa de transporte</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {operationalKpis.map((kpi) => (
          <Link key={kpi.title} href={kpi.href}>
            <Card className="hover:bg-muted/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Viajes enviados</CardTitle>
            <CardDescription>
              Documentación enviada al cliente, pendientes de facturar
              {stats.sentTripsCount > 0 && ` · ${stats.sentTripsCount} en total`}
            </CardDescription>
          </div>
          {stats.sentTripsCount > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/viajes?status=sent">
                Ver todos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {sentTrips.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No hay viajes en estado Enviado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carga</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Fecha carga</TableHead>
                  <TableHead className="text-right">Ingreso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sentTrips.map((trip) => {
                  const route =
                    trip.destination && trip.destination !== trip.origin
                      ? `${trip.origin} → ${trip.destination}`
                      : trip.origin || trip.destination || '—'

                  return (
                    <TableRow key={trip.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link href={`/app/viajes/${trip.id}`} className="font-mono text-sm font-medium">
                          {trip.code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{trip.clientName}</div>
                        {trip.accountId && (
                          <div className="text-xs text-muted-foreground font-mono">Cta. {trip.accountId}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{route}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {trip.departureDate ? dateFormatter.format(trip.departureDate) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {trip.totalIncome > 0 ? formatCurrency(trip.totalIncome) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acciones rápidas</CardTitle>
          <CardDescription>Accesos directos a tareas frecuentes</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Button key={action.label} variant="outline" asChild>
              <Link href={action.href}>
                <action.icon className="mr-2 h-4 w-4" />
                {action.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
