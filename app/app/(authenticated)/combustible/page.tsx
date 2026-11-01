import { getFuelTransactions } from '@/lib/data/fuel-transactions'
import { getTripFuelOptions } from '@/lib/data/trips'
import { getVehicles } from '@/lib/data/vehicles'
import { getDrivers } from '@/lib/data/drivers'
import { CombustibleView } from '@/components/fuel/combustible-view'

export default async function CombustiblePage() {
  const [transactions, trips, vehicles, drivers] = await Promise.all([
    getFuelTransactions(),
    getTripFuelOptions(),
    getVehicles(),
    getDrivers(),
  ])

  return (
    <CombustibleView
      transactions={transactions}
      trips={trips}
      vehicles={vehicles.map((v) => ({ id: v.id, plate: v.plate, brand: v.brand, type: v.type, status: v.status }))}
      drivers={drivers.map((d) => ({ id: d.id, name: d.name, status: d.status }))}
    />
  )
}
