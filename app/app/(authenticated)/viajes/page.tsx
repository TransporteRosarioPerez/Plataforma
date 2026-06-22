import { getTrips } from '@/lib/data/trips'
import { getArcorClients } from '@/lib/data/arcor-clients'
import { getVehicles } from '@/lib/data/vehicles'
import { getDrivers } from '@/lib/data/drivers'
import { ViajesView } from '@/components/trips/viajes-view'

export default async function ViajesPage() {
  const [trips, arcorClients, vehicles, drivers] = await Promise.all([
    getTrips(),
    getArcorClients(),
    getVehicles(),
    getDrivers(),
  ])
  return (
    <ViajesView
      trips={trips}
      arcorClients={arcorClients}
      vehicles={vehicles}
      drivers={drivers}
    />
  )
}
