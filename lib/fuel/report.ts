// Cálculos del reporte de combustible (puros, sin base de datos).
// Una carga con monto 0 es "precio pendiente": cuenta en litros pero no en pesos,
// y el precio promedio por litro se calcula solo con las cargas que tienen precio.

export type FuelLoadForReport = {
  transactionAt: Date
  plate: string
  vehicleId?: string
  vehicleType?: 'truck' | 'semi' | 'trailer'
  driverName?: string
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
