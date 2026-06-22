import { getVehicles } from '@/lib/data/vehicles'
import { getEntityDocuments } from '@/lib/data/documents'
import { FlotaView } from '@/components/fleet/flota-view'

export default async function FlotaPage() {
  const [vehicles, documents] = await Promise.all([
    getVehicles(),
    getEntityDocuments(),
  ])
  return <FlotaView vehicles={vehicles} documents={documents} />
}
