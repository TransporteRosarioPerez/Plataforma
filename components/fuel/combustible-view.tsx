'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Banknote, Droplets, Fuel, Gauge, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FuelTransactionsTable } from '@/components/fuel/fuel-transactions-table'
import { FuelVehicleReport } from '@/components/fuel/fuel-vehicle-report'
import { FuelLoadForm, type FleetDriver, type FleetVehicle } from '@/components/fuel/fuel-load-form'
import { formatArs, formatLiters, formatPricePerLiter, monthLabel } from '@/components/fuel/format'
import { fuelByVehicle, monthKey, summarizeFuel } from '@/lib/fuel/report'
import type { FuelTransaction } from '@/lib/types'

const ALL = 'all'

type CombustibleViewProps = {
  transactions: FuelTransaction[]
  trips: { id: string; code: string; vehiclePlate?: string; trailerPlate?: string }[]
  vehicles: FleetVehicle[]
  drivers: FleetDriver[]
}

export function CombustibleView({ transactions, trips, vehicles, drivers }: CombustibleViewProps) {
  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => monthKey(t.transactionAt)))
    set.add(monthKey(new Date()))
    return [...set].sort().reverse()
  }, [transactions])

  const [month, setMonth] = useState(() => {
    const latest = transactions[0] ? monthKey(transactions[0].transactionAt) : monthKey(new Date())
    return latest
  })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FuelTransaction | null>(null)

  const inPeriod = useMemo(
    () => (month === ALL ? transactions : transactions.filter((t) => monthKey(t.transactionAt) === month)),
    [transactions, month]
  )
  const summary = useMemo(() => summarizeFuel(inPeriod), [inPeriod])
  const byVehicle = useMemo(() => fuelByVehicle(inPeriod), [inPeriod])

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
          <p className="text-muted-foreground">Cargas por patente y chofer, con el total pagado y el precio por litro.</p>
        </div>
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
              ))}
              <SelectItem value={ALL}>Todo el historial</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva carga
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Droplets className="h-4 w-4" />} title="Litros" value={formatLiters(summary.liters)} hint={`${summary.loads} cargas`} />
        <Kpi icon={<Banknote className="h-4 w-4" />} title="Total pagado" value={formatArs(summary.amount)} hint="Solo cargas con precio" />
        <Kpi
          icon={<Gauge className="h-4 w-4" />}
          title="Precio promedio por litro"
          value={summary.avgPricePerLiter != null ? formatPricePerLiter(summary.avgPricePerLiter) : '—'}
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

      <Tabs defaultValue="vehiculos">
        <TabsList>
          <TabsTrigger value="vehiculos">Por camión</TabsTrigger>
          <TabsTrigger value="cargas">Cargas ({inPeriod.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="vehiculos">
          <Card>
            <CardHeader>
              <CardTitle>Litros y pesos por camión</CardTitle>
              <CardDescription>
                El precio promedio por litro se calcula solo con las cargas que tienen precio. Las patentes de
                semis aparecen como térmico (equipo de frío).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FuelVehicleReport rows={byVehicle} total={summary} />
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

function Kpi({ icon, title, value, hint, tone }: { icon: React.ReactNode; title: string; value: string; hint?: string; tone?: string }) {
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
      </CardContent>
    </Card>
  )
}
