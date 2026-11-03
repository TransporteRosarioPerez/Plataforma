'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Banknote, Droplets, Fuel, Gauge, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FuelTransactionsTable } from '@/components/fuel/fuel-transactions-table'
import { FuelVehicleReport } from '@/components/fuel/fuel-vehicle-report'
import { FuelDriverReport } from '@/components/fuel/fuel-driver-report'
import { FuelTripReport } from '@/components/fuel/fuel-trip-report'
import { FuelMonthlyCharts } from '@/components/fuel/fuel-monthly-charts'
import { FuelLoadForm, type FleetDriver, type FleetVehicle } from '@/components/fuel/fuel-load-form'
import { formatArs, formatLiters, formatPricePerLiter, monthLabel } from '@/components/fuel/format'
import {
  filterByMonths,
  fuelByDriver,
  fuelByMonth,
  fuelByTrip,
  fuelByVehicle,
  lastMonths,
  monthKey,
  pctChange,
  periodMonths,
  previousPeriodMonths,
  summarizeFuel,
  type FuelPeriod,
} from '@/lib/fuel/report'
import type { FuelTransaction } from '@/lib/types'

const RANGES: { value: FuelPeriod; label: string }[] = [
  { value: 'last-3', label: 'Últimos 3 meses' },
  { value: 'last-6', label: 'Últimos 6 meses' },
  { value: 'last-12', label: 'Últimos 12 meses' },
  { value: 'all', label: 'Todo el historial' },
]

const isSemi = (t: FuelTransaction) => t.vehicleType === 'semi' || t.vehicleType === 'trailer'

type CombustibleViewProps = {
  transactions: FuelTransaction[]
  trips: { id: string; code: string; departureDate?: Date; totalKilometers?: number; vehiclePlate?: string; trailerPlate?: string }[]
  vehicles: FleetVehicle[]
  drivers: FleetDriver[]
}

export function CombustibleView({ transactions, trips, vehicles, drivers }: CombustibleViewProps) {
  const currentMonth = useMemo(() => monthKey(new Date()), [])

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => monthKey(t.transactionAt)))
    set.add(currentMonth)
    return [...set].sort().reverse()
  }, [transactions, currentMonth])

  const [period, setPeriod] = useState<FuelPeriod>(() =>
    transactions[0] ? monthKey(transactions[0].transactionAt) : currentMonth
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FuelTransaction | null>(null)

  const inPeriod = useMemo(
    () => filterByMonths(transactions, periodMonths(period, currentMonth)),
    [transactions, period, currentMonth]
  )
  const previous = useMemo(() => {
    const prevMonths = previousPeriodMonths(period, currentMonth)
    return prevMonths ? summarizeFuel(filterByMonths(transactions, prevMonths)) : null
  }, [transactions, period, currentMonth])

  const summary = useMemo(() => summarizeFuel(inPeriod), [inPeriod])
  const truckLoads = useMemo(() => inPeriod.filter((t) => !isSemi(t)), [inPeriod])
  const semiLoads = useMemo(() => inPeriod.filter(isSemi), [inPeriod])
  const trucks = useMemo(() => ({ rows: fuelByVehicle(truckLoads), total: summarizeFuel(truckLoads) }), [truckLoads])
  const semis = useMemo(() => ({ rows: fuelByVehicle(semiLoads), total: summarizeFuel(semiLoads) }), [semiLoads])
  const byDriver = useMemo(() => fuelByDriver(inPeriod), [inPeriod])
  const byTrip = useMemo(() => fuelByTrip(inPeriod, trips), [inPeriod, trips])

  const chartEnd = /^\d{4}-\d{2}$/.test(period) ? period : currentMonth
  const monthly = useMemo(() => fuelByMonth(transactions, lastMonths(chartEnd, 12)), [transactions, chartEnd])

  const periodLabel = RANGES.find((r) => r.value === period)?.label ?? monthLabel(period)
  const compareLabel = period === 'all' ? null : /^\d{4}-\d{2}$/.test(period) ? 'vs mes anterior' : 'vs período anterior'

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (t: FuelTransaction) => {
    setEditing(t)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Fuel className="h-7 w-7" />
            Combustible
          </h1>
          <p className="text-muted-foreground">Cuánto se carga y cuánto se paga, por camión, semi, chofer y viaje.</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[190px]">
              <SelectValue>{periodLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Mes</SelectLabel>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Rango</SelectLabel>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva carga
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Droplets className="h-4 w-4" />}
          title="Litros"
          value={formatLiters(summary.liters)}
          hint={`${summary.loads} cargas`}
          delta={previous ? pctChange(summary.liters, previous.liters) : null}
          compareLabel={compareLabel}
        />
        <Kpi
          icon={<Banknote className="h-4 w-4" />}
          title="Total pagado"
          value={formatArs(summary.amount)}
          hint="Solo cargas con precio"
          delta={previous ? pctChange(summary.amount, previous.amount) : null}
          compareLabel={compareLabel}
        />
        <Kpi
          icon={<Gauge className="h-4 w-4" />}
          title="Precio promedio por litro"
          value={summary.avgPricePerLiter != null ? formatPricePerLiter(summary.avgPricePerLiter) : '—'}
          delta={previous ? pctChange(summary.avgPricePerLiter, previous.avgPricePerLiter) : null}
          compareLabel={compareLabel}
        />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Cargas sin precio"
          value={String(summary.pendingPriceLoads)}
          tone={summary.pendingPriceLoads > 0 ? 'text-amber-700 dark:text-amber-400' : undefined}
          hint={
            summary.pendingPriceLoads > 0
              ? `${formatLiters(summary.pendingPriceLiters)} · ≈ ${formatArs(summary.estimatedPendingAmount)}`
              : 'Todo con precio'
          }
        />
      </div>

      <Tabs defaultValue="resumen">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="resumen">Evolución</TabsTrigger>
            <TabsTrigger value="camiones">Camiones ({trucks.rows.length})</TabsTrigger>
            <TabsTrigger value="semis">Semis / térmicos ({semis.rows.length})</TabsTrigger>
            <TabsTrigger value="choferes">Choferes ({byDriver.length})</TabsTrigger>
            <TabsTrigger value="viajes">Viajes ({byTrip.length})</TabsTrigger>
            <TabsTrigger value="cargas">Cargas ({inPeriod.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumen">
          <Card>
            <CardHeader>
              <CardTitle>Mes a mes</CardTitle>
              <CardDescription>
                Los 12 meses hasta {monthLabel(chartEnd).toLowerCase()}. Pasá el mouse por una barra para ver litros y cargas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FuelMonthlyCharts rows={monthly} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="camiones">
          <Card>
            <CardHeader>
              <CardTitle>Camiones</CardTitle>
              <CardDescription>
                Litros y pesos de cada camión en {periodLabel.toLowerCase()}. El % es sobre lo pagado por todos los camiones.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FuelVehicleReport rows={trucks.rows} total={trucks.total} emptyText="No hay cargas de camiones en este período." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="semis">
          <Card>
            <CardHeader>
              <CardTitle>Semis / térmicos</CardTitle>
              <CardDescription>
                Combustible cargado a la patente de un semi: es el que usa el equipo de frío (térmico).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FuelVehicleReport rows={semis.rows} total={semis.total} emptyText="No hay cargas de semis en este período." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="choferes">
          <Card>
            <CardHeader>
              <CardTitle>Choferes</CardTitle>
              <CardDescription>
                Todo lo que cargó cada chofer, sumando camión y térmico. Ordenado por pesos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FuelDriverReport rows={byDriver} total={summary} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="viajes">
          <Card>
            <CardHeader>
              <CardTitle>Viajes</CardTitle>
              <CardDescription>
                Combustible de cada viaje y su rendimiento con los km del viaje. Es aproximado: si falta cargar alguna
                carga del viaje, el consumo da más bajo de lo real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FuelTripReport rows={byTrip} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cargas">
          <Card>
            <CardHeader>
              <CardTitle>Cargas</CardTitle>
              <CardDescription>
                Cada carga se vincula sola al viaje del camión en esa fecha; si no, podés elegirlo a mano. En amarillo,
                las que todavía no tienen precio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FuelTransactionsTable transactions={inPeriod} trips={trips} onEdit={openEdit} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FuelLoadForm open={formOpen} onOpenChange={setFormOpen} editing={editing} vehicles={vehicles} drivers={drivers} />
    </div>
  )
}

function Kpi({
  icon,
  title,
  value,
  hint,
  tone,
  delta,
  compareLabel,
}: {
  icon: React.ReactNode
  title: string
  value: string
  hint?: string
  tone?: string
  delta?: number | null
  compareLabel?: string | null
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold tabular-nums ${tone ?? ''}`}>{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        {compareLabel && delta !== undefined && (
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {delta == null
              ? `Sin datos para comparar`
              : `${delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : ''}${delta.toLocaleString('es-AR')}% ${compareLabel}`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
