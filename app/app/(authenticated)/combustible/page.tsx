import { getFuelTransactions } from '@/lib/data/fuel-transactions'
import { getTrips } from '@/lib/data/trips'
import { CombustibleView } from '@/components/fuel/combustible-view'

export default async function CombustiblePage() {
  const [transactions, trips] = await Promise.all([
    getFuelTransactions(),
    getTrips(),
  ])

  const tripOptions = trips.map((t) => ({
    id: t.id,
    code: t.code,
    vehiclePlate: t.vehicle?.plate,
    trailerPlate: t.trailer?.plate,
  }))

  return <CombustibleView transactions={transactions} trips={tripOptions} />
}
