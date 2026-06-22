import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { TripDocument, TripDocumentType, RemitoStatus } from '@/lib/types'

type DbTripDocument = {
  id: string
  trip_id: string
  document_type: string
  document_number: string | null
  client_id: string | null
  client_name: string | null
  destination: string | null
  file_name: string | null
  file_url: string | null
  storage_path: string | null
  status: RemitoStatus
  observation_notes: string | null
  uploaded_at: string
}

function mapDoc(row: DbTripDocument): TripDocument {
  return {
    id: row.id,
    tripId: row.trip_id,
    documentType: row.document_type as TripDocumentType,
    documentNumber: row.document_number ?? undefined,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name ?? undefined,
    destination: row.destination ?? undefined,
    fileName: row.file_name ?? 'documento',
    fileUrl: row.file_url ?? '',
    storagePath: row.storage_path ?? undefined,
    status: row.status,
    observationNotes: row.observation_notes ?? undefined,
    uploadedAt: new Date(row.uploaded_at),
  }
}

export const getTripDocuments = cache(async (tripId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as DbTripDocument[]).map(mapDoc)
})
