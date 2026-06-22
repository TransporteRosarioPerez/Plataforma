import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getVehicleById } from '@/lib/data/vehicles'
import {
  getEntityDocuments,
  getEntityDocumentHistory,
} from '@/lib/data/documents'
import { EntityDocumentsPanel } from '@/components/documents/entity-documents-panel'
import { FlotaDetailActions } from '@/components/fleet/flota-detail-actions'

export default async function FlotaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const vehicle = await getVehicleById(id)
  if (!vehicle) notFound()

  const [allDocs, history] = await Promise.all([
    getEntityDocuments(),
    getEntityDocumentHistory(id, 'vehicle'),
  ])
  const docs = allDocs.filter((d) => d.entityId === id && d.entityType === 'vehicle')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/flota"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-mono">{vehicle.plate}</h1>
          <p className="text-muted-foreground">{vehicle.brand} {vehicle.model} ({vehicle.year})</p>
        </div>
        <Badge>{vehicle.status}</Badge>
        <FlotaDetailActions vehicle={vehicle} />
      </div>
      <Card>
        <CardHeader><CardTitle>Datos del vehículo</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Patente:</span> {vehicle.plate}</p>
          <p><span className="text-muted-foreground">Tipo:</span> {vehicle.type}</p>
          <p><span className="text-muted-foreground">Marca / Modelo:</span> {vehicle.brand} {vehicle.model}</p>
          <p><span className="text-muted-foreground">Año:</span> {vehicle.year}</p>
        </CardContent>
      </Card>
      <EntityDocumentsPanel
        entityId={id}
        entityType="vehicle"
        documents={docs}
        history={history}
      />
    </div>
  )
}
