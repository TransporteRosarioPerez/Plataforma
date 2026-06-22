import { getClients } from '@/lib/data/clients'
import { ClientsView } from '@/components/clients/clients-view'

export default async function ClientesPage() {
  const clients = await getClients()
  return <ClientsView clients={clients} />
}
