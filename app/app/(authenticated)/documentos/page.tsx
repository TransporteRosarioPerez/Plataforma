import { getExpiringDocuments } from '@/lib/data/documents'
import { DocumentosView } from '@/components/documents/documentos-view'

export default async function DocumentosPage() {
  const { documents } = await getExpiringDocuments()
  return <DocumentosView documents={documents} />
}
