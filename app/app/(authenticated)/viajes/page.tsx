import { getTripsForList } from '@/lib/data/trips'
import { getArcorClients } from '@/lib/data/arcor-clients'
import { getVehicles } from '@/lib/data/vehicles'
import { getDrivers } from '@/lib/data/drivers'
import { ViajesView } from '@/components/trips/viajes-view'
import { parseTripListFilters } from '@/lib/trips/list-filters'

type ViajesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function toUrlSearchParams(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, entry)
    } else {
      search.set(key, value)
    }
  }
  return search
}

export default async function ViajesPage({ searchParams }: ViajesPageProps) {
  const filters = parseTripListFilters(toUrlSearchParams(await searchParams))
  const [trips, arcorClients, vehicles, drivers] = await Promise.all([
    getTripsForList(filters),
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
