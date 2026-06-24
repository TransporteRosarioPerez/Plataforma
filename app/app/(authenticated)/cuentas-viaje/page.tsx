import { getArcorClients } from '@/lib/data/arcor-clients'
import { ArcorClientsView } from '@/components/arcor-clients/arcor-clients-view'

export default async function CuentasViajePage() {
  const clients = await getArcorClients()
  return <ArcorClientsView clients={clients} />
}
