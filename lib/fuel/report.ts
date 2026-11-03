// Cálculos del reporte de combustible (puros, sin base de datos).
// Una carga con monto 0 es "precio pendiente": cuenta en litros pero no en pesos,
// y el precio promedio por litro se calcula solo con las cargas que tienen precio.

export type FuelLoadForReport = {
  transactionAt: Date
  plate: string
  vehicleId?: string
  vehicleType?: 'truck' | 'semi' | 'trailer'
  driverId?: string
  driverName?: string
  tripId?: string
  liters: number
  amountTotal: number
  odometerKm?: number
}

export function hasPrice(load: Pick<FuelLoadForReport, 'amountTotal' | 'liters'>): boolean {
  return load.amountTotal > 0 && load.liters > 0
}

export function pricePerLiter(load: Pick<FuelLoadForReport, 'amountTotal' | 'liters'>): number | null {
  return hasPrice(load) ? load.amountTotal / load.liters : null
}

export type FuelSummary = {
  loads: number
  liters: number
  amount: number
  /** Promedio ponderado: $ pagados / litros con precio */
  avgPricePerLiter: number | null
  pendingPriceLoads: number
  pendingPriceLiters: number
  /** Litros sin precio × precio promedio */
  estimatedPendingAmount: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function summarizeFuel(loads: FuelLoadForReport[]): FuelSummary {
  let liters = 0
  let amount = 0
  let pricedLiters = 0
  let pendingPriceLoads = 0
  let pendingPriceLiters = 0

  for (const l of loads) {
    liters += l.liters
    if (hasPrice(l)) {
      amount += l.amountTotal
      pricedLiters += l.liters
    } else {
      pendingPriceLoads++
      pendingPriceLiters += l.liters
    }
  }

  const avg = pricedLiters > 0 ? amount / pricedLiters : null
  return {
    loads: loads.length,
    liters: round2(liters),
    amount: round2(amount),
    avgPricePerLiter: avg != null ? round2(avg) : null,
    pendingPriceLoads,
    pendingPriceLiters: round2(pendingPriceLiters),
    estimatedPendingAmount: avg != null ? round2(pendingPriceLiters * avg) : 0,
  }
}

export type FuelConsumption = {
  km: number
  /** Litros cargados después de la primera lectura de odómetro (tanque lleno a tanque lleno) */
  liters: number
  litersPer100Km: number
}

/** Necesita al menos 2 lecturas de odómetro en el período. */
export function consumption(loads: FuelLoadForReport[]): FuelConsumption | null {
  const withKm = loads
    .filter((l) => l.odometerKm != null && l.odometerKm > 0)
    .sort((a, b) => a.transactionAt.getTime() - b.transactionAt.getTime() || a.odometerKm! - b.odometerKm!)
  if (withKm.length < 2) return null

  const km = withKm[withKm.length - 1].odometerKm! - withKm[0].odometerKm!
  if (km <= 0) return null
  const liters = withKm.slice(1).reduce((s, l) => s + l.liters, 0)
  return { km, liters: round2(liters), litersPer100Km: round2((liters / km) * 100) }
}

export type FuelVehicleRow = FuelSummary & {
  key: string
  plate: string
  vehicleId?: string
  vehicleType?: FuelLoadForReport['vehicleType']
  drivers: string[]
  consumption: FuelConsumption | null
}

/** Agrupa por vehículo de la flota (o por patente tipeada si no está en la flota). Ordena por litros. */
export function fuelByVehicle(loads: FuelLoadForReport[]): FuelVehicleRow[] {
  const groups = new Map<string, FuelLoadForReport[]>()
  for (const l of loads) {
    const key = l.vehicleId ?? `plate:${l.plate.toUpperCase()}`
    const list = groups.get(key) ?? []
    list.push(l)
    groups.set(key, list)
  }

  return [...groups.entries()]
    .map(([key, list]) => {
      const first = list.find((l) => l.vehicleId) ?? list[0]
      const drivers = [...new Set(list.map((l) => l.driverName?.trim()).filter((d): d is string => !!d))]
      return {
        key,
        plate: first.plate,
        vehicleId: first.vehicleId,
        vehicleType: first.vehicleType,
        drivers,
        consumption: consumption(list),
        ...summarizeFuel(list),
      }
    })
    .sort((a, b) => b.liters - a.liters)
}

/** "2026-10" en hora de Argentina. */
export function monthKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')!.value
  const m = parts.find((p) => p.type === 'month')!.value
  return `${y}-${m}`
}

// ---------------------------------------------------------------------------
// Períodos

export type FuelPeriod = string // '2026-10' | 'last-3' | 'last-6' | 'last-12' | 'all'

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** Los n meses que terminan en endKey, del más viejo al más nuevo. */
export function lastMonths(endKey: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(endKey, i - n + 1))
}

/** Meses que cubre el período (null = todo el historial). */
export function periodMonths(period: FuelPeriod, currentMonth: string): string[] | null {
  if (period === 'all') return null
  const last = /^last-(\d+)$/.exec(period)
  if (last) return lastMonths(currentMonth, Number(last[1]))
  return [period]
}

/** El período inmediatamente anterior, de la misma duración (null si no aplica). */
export function previousPeriodMonths(period: FuelPeriod, currentMonth: string): string[] | null {
  const months = periodMonths(period, currentMonth)
  if (!months) return null
  return months.map((m) => shiftMonth(m, -months.length))
}

export function filterByMonths<T extends Pick<FuelLoadForReport, 'transactionAt'>>(loads: T[], months: string[] | null): T[] {
  if (!months) return loads
  const set = new Set(months)
  return loads.filter((l) => set.has(monthKey(l.transactionAt)))
}

/** Variación porcentual; null si no hay base para comparar. */
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function share(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0
}

// ---------------------------------------------------------------------------
// Agrupaciones

export type FuelMonthRow = FuelSummary & { month: string }

/** Una fila por mes pedido, aunque no tenga cargas (para que el gráfico no salte meses). */
export function fuelByMonth(loads: FuelLoadForReport[], months: string[]): FuelMonthRow[] {
  const groups = new Map<string, FuelLoadForReport[]>(months.map((m) => [m, []]))
  for (const l of loads) groups.get(monthKey(l.transactionAt))?.push(l)
  return months.map((month) => ({ month, ...summarizeFuel(groups.get(month)!) }))
}

export type FuelDriverRow = FuelSummary & {
  key: string
  name: string
  driverId?: string
  plates: string[]
}

export function fuelByDriver(loads: FuelLoadForReport[]): FuelDriverRow[] {
  const groups = new Map<string, FuelLoadForReport[]>()
  for (const l of loads) {
    const key = l.driverId ?? (l.driverName?.trim() ? `name:${l.driverName.trim().toUpperCase()}` : 'none')
    const list = groups.get(key) ?? []
    list.push(l)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      name: list.find((l) => l.driverName)?.driverName?.trim() || 'Sin chofer',
      driverId: list[0].driverId,
      plates: [...new Set(list.map((l) => l.plate))].sort(),
      ...summarizeFuel(list),
    }))
    .sort((a, b) => b.amount - a.amount || b.liters - a.liters)
}

export type FuelTripInfo = { id: string; code: string; totalKilometers?: number; departureDate?: Date }

export type FuelTripRow = FuelSummary & {
  tripId: string
  code: string
  departureDate?: Date
  km?: number
  plates: string[]
  drivers: string[]
  /** Litros cargados en el viaje / km del viaje. Aproximado: depende de que estén todas las cargas. */
  litersPer100Km: number | null
  costPerKm: number | null
}

export function fuelByTrip(loads: FuelLoadForReport[], trips: FuelTripInfo[]): FuelTripRow[] {
  const byId = new Map(trips.map((t) => [t.id, t]))
  const groups = new Map<string, FuelLoadForReport[]>()
  for (const l of loads) {
    if (!l.tripId || !byId.has(l.tripId)) continue
    const list = groups.get(l.tripId) ?? []
    list.push(l)
    groups.set(l.tripId, list)
  }
  return [...groups.entries()]
    .map(([tripId, list]) => {
      const trip = byId.get(tripId)!
      const summary = summarizeFuel(list)
      const km = trip.totalKilometers && trip.totalKilometers > 0 ? trip.totalKilometers : undefined
      return {
        tripId,
        code: trip.code,
        departureDate: trip.departureDate,
        km,
        plates: [...new Set(list.map((l) => l.plate))].sort(),
        drivers: [...new Set(list.map((l) => l.driverName?.trim()).filter((d): d is string => !!d))],
        litersPer100Km: km ? round2((summary.liters / km) * 100) : null,
        costPerKm: km && summary.amount > 0 ? round2(summary.amount / km) : null,
        ...summary,
      }
    })
    .sort((a, b) => (b.departureDate?.getTime() ?? 0) - (a.departureDate?.getTime() ?? 0))
}
