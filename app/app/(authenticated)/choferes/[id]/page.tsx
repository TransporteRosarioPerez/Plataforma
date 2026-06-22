import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDriverById } from '@/lib/data/drivers'
import {
  getEntityDocuments,
  getEntityDocumentHistory,
} from '@/lib/data/documents'
import { EntityDocumentsPanel } from '@/components/documents/entity-documents-panel'
import { ChoferDetailActions } from '@/components/drivers/chofer-detail-actions'

export default async function ChoferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const driver = await getDriverById(id)
  if (!driver) notFound()

  const [allDocs, history] = await Promise.all([
    getEntityDocuments(),
    getEntityDocumentHistory(id, 'driver'),
  ])
  const docs = allDocs.filter((d) => d.entityId === id && d.entityType === 'driver')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/choferes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{driver.name}</h1>
          <p className="text-muted-foreground">DNI {driver.dni}</p>
        </div>
        <Badge>{driver.status === 'active' ? 'Activo' : 'Inactivo'}</Badge>
        <ChoferDetailActions driver={driver} />
      </div>
      <Card>
        <CardHeader><CardTitle>Datos del chofer</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Nombre:</span> {driver.name}</p>
          <p><span className="text-muted-foreground">DNI:</span> {driver.dni}</p>
          {driver.phone && <p><span className="text-muted-foreground">Teléfono:</span> {driver.phone}</p>}
          {driver.email && <p><span className="text-muted-foreground">Email:</span> {driver.email}</p>}
          {driver.licenseNumber && (
            <p><span className="text-muted-foreground">Licencia:</span> {driver.licenseNumber}</p>
          )}
        </CardContent>
      </Card>
      <EntityDocumentsPanel
        entityId={id}
        entityType="driver"
        documents={docs}
        history={history}
      />
    </div>
  )
}
