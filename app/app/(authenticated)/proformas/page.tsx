import { getProformas } from '@/lib/data/proformas'
import { getClients } from '@/lib/data/clients'
import { getTrips } from '@/lib/data/trips'
import { ProformasView } from '@/components/proformas/proformas-view'

export default async function ProformasPage() {
  const [proformas, clients, trips] = await Promise.all([
    getProformas(),
    getClients(),
    getTrips(),
  ])

  return <ProformasView proformas={proformas} clients={clients} trips={trips} />
}
