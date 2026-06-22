import { getDrivers } from '@/lib/data/drivers'
import { ChoferesView } from '@/components/drivers/choferes-view'

export default async function ChoferesPage() {
  const drivers = await getDrivers()
  return <ChoferesView drivers={drivers} />
}
