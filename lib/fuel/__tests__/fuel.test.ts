// Tests del módulo Combustible: pnpm test:combustible
// Fixture: planilla en papel de octubre 2026 (montos escritos a mano).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fuelByDriver,
  fuelByMonth,
  fuelByTrip,
  fuelByVehicle,
  monthKey,
  pctChange,
  periodMonths,
  previousPeriodMonths,
  pricePerLiter,
  share,
  summarizeFuel,
  type FuelLoadForReport,
} from '@/lib/fuel/report'
import { matchFuelRowToTrips } from '@/lib/fuel/matcher'

const fleet = [
  { id: 'v1', plate: 'AA154YE', type: 'truck' as const },
  { id: 'v2', plate: 'AC755XY', type: 'semi' as const },
  { id: 'v3', plate: 'AA511AB', type: 'truck' as const },
  { id: 'v4', plate: 'AH553HD', type: 'truck' as const },
  { id: 'v5', plate: 'AG585JX', type: 'truck' as const },
  { id: 'v6', plate: 'LFI599', type: 'truck' as const },
  { id: 'v7', plate: 'AE768HQ', type: 'semi' as const },
]

// [vehículo elegido en el selector, chofer, fecha, litros, total $ (0 = sin precio)]
const paper: [string, string, string, number, number][] = [
  ['AA154YE', 'Matias Raul', '2026-10-02', 343.75, 848723.69],
  ['AC755XY', 'Matias Raul', '2026-10-02', 46.92, 115833.14],
  ['AA511AB', 'Hugo Mariano', '2026-10-05', 455.08, 1085820.33],
  ['AH553HD', 'Facundo', '2026-10-03', 407.0, 988824],
  ['AA511AB', 'Hugo Mariano', '2026-10-05', 117.86, 286998.84],
  ['AA511AB', 'Hugo Mariano', '2026-10-08', 463.48, 0],
  ['AH553HD', 'Facundo', '2026-10-04', 235.31, 580811.55],
  ['AH553HD', 'Facundo', '2026-10-05', 268.39, 661581.35],
  ['AH553HD', 'Facundo', '2026-10-07', 270.2, 671176.5],
  ['AH553HD', 'Facundo', '2026-10-08', 258.0, 0],
  ['AG585JX', 'Luis Alberto', '2026-10-03', 410.57, 1012047.0],
  ['AA154YE', 'Matias Raul', '2026-10-06', 337.38, 819825.87],
  ['LFI599', 'Gustavo Javier', '2026-10-03', 201.2, 488903.85],
  ['LFI599', 'Gustavo Javier', '2026-10-06', 164.1, 392012.96],
  ['LFI599', 'Gustavo Javier', '2026-10-07', 162.14, 388001.02],
  ['AE768HQ', 'Gustavo Javier', '2026-10-03', 92.13, 223868],
  ['AE768HQ', 'Gustavo Javier', '2026-10-06', 60.53, 0],
]

function toLoads(): FuelLoadForReport[] {
  return paper.map(([plate, driver, date, liters, total]) => {
    const v = fleet.find((f) => f.plate === plate)!
    return {
      transactionAt: new Date(`${date}T12:00:00-03:00`),
      plate: v.plate,
      vehicleId: v.id,
      vehicleType: v.type,
      driverName: driver,
      liters,
      amountTotal: total,
    }
  })
}

test('precio por litro sale del total pagado', () => {
  assert.equal(pricePerLiter({ liters: 343.75, amountTotal: 848723.69 })?.toFixed(2), '2469.01')
  assert.equal(pricePerLiter({ liters: 463.48, amountTotal: 0 }), null)
})

test('resumen del mes: cargas sin precio cuentan litros pero no pesos', () => {
  const s = summarizeFuel(toLoads())
  assert.equal(s.loads, 17)
  assert.equal(s.liters, 4294.04)
  assert.equal(s.amount, 8564428.1)
  assert.equal(s.pendingPriceLoads, 3)
  assert.equal(s.pendingPriceLiters, 782.01)
  // 8.564.428,10 / (4294,04 - 782,01) = $2.438,60 por litro
  assert.equal(s.avgPricePerLiter, 2438.6)
  assert.ok(s.estimatedPendingAmount > 0)
})

test('reporte por camión agrupa por vehículo y separa el térmico (semi)', () => {
  const rows = fuelByVehicle(toLoads())
  assert.equal(rows.length, 7)
  const aa154 = rows.find((r) => r.plate === 'AA154YE')!
  assert.equal(aa154.loads, 2)
  assert.equal(aa154.liters, 681.13)
  assert.equal(aa154.amount, 1668549.56)
  const ah553 = rows.find((r) => r.plate === 'AH553HD')!
  assert.equal(ah553.loads, 5)
  assert.equal(ah553.pendingPriceLoads, 1)
  assert.equal(ah553.liters, 1438.9)
  const term = rows.find((r) => r.plate === 'AC755XY')!
  assert.equal(term.vehicleType, 'semi')
  assert.deepEqual(term.drivers, ['Matias Raul'])
  assert.equal(rows[0].plate, 'AH553HD', 'ordenado por litros')
})

test('consumo L/100 km con lecturas de odómetro', () => {
  const loads: FuelLoadForReport[] = [
    { transactionAt: new Date('2026-10-01T12:00:00-03:00'), plate: 'X', liters: 400, amountTotal: 1, odometerKm: 100000 },
    { transactionAt: new Date('2026-10-03T12:00:00-03:00'), plate: 'X', liters: 300, amountTotal: 1, odometerKm: 100900 },
    { transactionAt: new Date('2026-10-05T12:00:00-03:00'), plate: 'X', liters: 330, amountTotal: 1, odometerKm: 102000 },
  ]
  const [row] = fuelByVehicle(loads)
  assert.deepEqual(row.consumption, { km: 2000, liters: 630, litersPer100Km: 31.5 })
  assert.equal(fuelByVehicle(loads.slice(0, 1))[0].consumption, null)
})

test('mes en hora argentina', () => {
  assert.equal(monthKey(new Date('2026-11-01T01:00:00Z')), '2026-10')
})

test('carga manual se vincula al viaje del camión en esas fechas', () => {
  const trips = [
    { id: 't1', code: 'V-100', status: 'in_progress', departureDate: new Date('2026-10-01T00:00:00-03:00'), arrivalDate: new Date('2026-10-06T00:00:00-03:00'), vehiclePlate: 'AH553HD', trailerPlate: 'AC755XY' },
  ]
  const r = matchFuelRowToTrips({ plate: 'AH553HD', transactionAt: new Date('2026-10-04T12:00:00-03:00') }, trips)
  assert.equal(r.status, 'linked')
  assert.equal(r.matchedPlateRole, 'truck')
  assert.equal(matchFuelRowToTrips({ plate: 'AC755XY', transactionAt: new Date('2026-10-02T12:00:00-03:00') }, trips).matchedPlateRole, 'semi')
  assert.equal(matchFuelRowToTrips({ plate: 'AH553HD', transactionAt: new Date('2026-10-08T12:00:00-03:00') }, trips).status, 'unlinked')
})

test('períodos: mes, últimos n meses y el período anterior', () => {
  assert.deepEqual(periodMonths('2026-10', '2026-11'), ['2026-10'])
  assert.deepEqual(previousPeriodMonths('2026-01', '2026-11'), ['2025-12'])
  assert.deepEqual(periodMonths('last-3', '2026-02'), ['2025-12', '2026-01', '2026-02'])
  assert.deepEqual(previousPeriodMonths('last-3', '2026-02'), ['2025-09', '2025-10', '2025-11'])
  assert.equal(periodMonths('all', '2026-11'), null)
  assert.equal(previousPeriodMonths('all', '2026-11'), null)
  assert.equal(pctChange(110, 100), 10)
  assert.equal(pctChange(5, 0), null)
  assert.equal(share(25, 200), 12.5)
})

test('por chofer: suma todas sus unidades, ordenado por pesos', () => {
  const rows = fuelByDriver(toLoads())
  assert.equal(rows.length, 5)
  const facundo = rows.find((r) => r.name === 'Facundo')!
  assert.equal(facundo.loads, 5)
  assert.equal(facundo.liters, 1438.9)
  assert.equal(facundo.amount, 2902393.4)
  const gustavo = rows.find((r) => r.name === 'Gustavo Javier')!
  assert.deepEqual(gustavo.plates, ['AE768HQ', 'LFI599'], 'camión y térmico')
  assert.equal(gustavo.pendingPriceLoads, 1)
  assert.equal(rows[0].name, 'Facundo', 'el que más gastó primero')
  assert.equal(rows.reduce((s, r) => s + r.loads, 0), 17)
})

test('por mes: completa los meses sin cargas', () => {
  const rows = fuelByMonth(toLoads(), ['2026-09', '2026-10', '2026-11'])
  assert.deepEqual(rows.map((r) => r.loads), [0, 17, 0])
  assert.equal(rows[1].avgPricePerLiter, 2438.6)
  assert.equal(rows[0].avgPricePerLiter, null)
})

test('por viaje: litros cada 100 km y costo por km con los km del viaje', () => {
  const loads = toLoads().map((l) => (l.plate === 'AH553HD' ? { ...l, tripId: 't1' } : l))
  const rows = fuelByTrip(loads, [{ id: 't1', code: 'V-100', totalKilometers: 4000 }, { id: 't2', code: 'V-200' }])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].liters, 1438.9)
  assert.equal(rows[0].litersPer100Km, 35.97)
  assert.equal(rows[0].costPerKm, 725.6)
  assert.deepEqual(rows[0].drivers, ['Facundo'])
})
