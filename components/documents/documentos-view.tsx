import { ExpiringDocumentsTable } from '@/components/documents/expiring-documents-table'
import type { ExpiringDocumentRow } from '@/lib/data/documents'

type DocumentosViewProps = {
  documents: ExpiringDocumentRow[]
}

export function DocumentosView({ documents }: DocumentosViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vencimientos</h1>
        <p className="text-muted-foreground">
          Documentos recurrentes por vencer o vencidos. Hacé clic en una fila o en Renovar para cargar la nueva versión.
          Los documentos únicos no llevan vencimiento y no aparecen acá.
        </p>
      </div>

      <ExpiringDocumentsTable documents={documents} />
    </div>
  )
}
