import { getFuelTransactions } from '@/lib/data/fuel-transactions'
import { getTripFuelOptions } from '@/lib/data/trips'
import { CombustibleView } from '@/components/fuel/combustible-view'

export default async function CombustiblePage() {
  const [transactions, trips] = await Promise.all([
    getFuelTransactions(),
    getTripFuelOptions(),
  ])

  return <CombustibleView transactions={transactions} trips={trips} />
}
