import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { DocumentRecord, DocumentEntityType, RenewalFrequency } from '@/lib/types'
import { computeDocumentStatus, daysUntilExpiry } from '@/lib/documents/status'
import { parseDateOnly } from '@/lib/documents/dates'

type DbEntityDocument = {
  id: string
  name: string
  document_group_id: string
  renewal_frequency: string
  entity_id: string
  entity_type: 'vehicle' | 'driver' | 'company'
  file_name: string | null
  file_url: string | null
  issue_date: string | null
  expiry_date: string | null
  status: 'valid' | 'expiring_soon' | 'expired' | 'missing'
  notes: string | null
  uploaded_at: string | null
  is_current: boolean
  superseded_at: string | null
}

export type ExpiringDocumentRow = {
  id: string
  entityType: DocumentEntityType
  entityId: string
  entityLabel: string
  entityHref: string
  documentName: string
  expiryDate?: Date
  status: DocumentRecord['status']
  daysUntilExpiry?: number
  notes?: string
}

function mapEntityDocument(row: DbEntityDocument): DocumentRecord {
  return {
    id: row.id,
    organizationId: '',
    name: row.name,
    documentGroupId: row.document_group_id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    fileName: row.file_name ?? undefined,
    fileUrl: row.file_url ?? undefined,
    issueDate: row.issue_date ? parseDateOnly(row.issue_date) : undefined,
    expiryDate: row.expiry_date ? parseDateOnly(row.expiry_date) : undefined,
    status: row.status,
    uploadedAt: row.uploaded_at ? new Date(row.uploaded_at) : undefined,
    notes: row.notes ?? undefined,
    isCurrent: row.is_current,
    supersededAt: row.superseded_at ? new Date(row.superseded_at) : undefined,
    renewalFrequency: row.renewal_frequency as RenewalFrequency,
  }
}

export const getEntityDocuments = cache(async (currentOnly = true) => {
  const supabase = await createClient()
  let query = supabase.from('entity_documents').select('*').is('deleted_at', null).order('name')

  if (currentOnly) {
    query = query.eq('is_current', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data as DbEntityDocument[]).map(mapEntityDocument)
})

export const getEntityDocumentHistory = cache(
  async (entityId: string, entityType: DocumentEntityType) => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('entity_documents')
      .select('*')
      .is('deleted_at', null)
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .eq('is_current', false)
      .order('superseded_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data as DbEntityDocument[]).map(mapEntityDocument)
  }
)

export type ExpiringDocumentsResult = {
  documents: ExpiringDocumentRow[]
  alertDaysBefore: number
}

export const getExpiringDocuments = cache(async (): Promise<ExpiringDocumentsResult> => {
  const supabase = await createClient()

  const [docsRes, vehiclesRes, driversRes, companyRes] = await Promise.all([
    supabase
      .from('entity_documents')
      .select('*')
      .is('deleted_at', null)
      .eq('is_current', true)
      .not('expiry_date', 'is', null),
    supabase.from('vehicles').select('id, plate').is('deleted_at', null),
    supabase.from('drivers').select('id, name').is('deleted_at', null),
    supabase.from('company_settings').select('name, alert_days_before').limit(1).maybeSingle(),
  ])

  if (docsRes.error) throw new Error(docsRes.error.message)

  const alertDays = companyRes.data?.alert_days_before ?? 7
  const vehicleMap = new Map((vehiclesRes.data ?? []).map((v) => [v.id, v.plate as string]))
  const driverMap = new Map((driversRes.data ?? []).map((d) => [d.id, d.name as string]))
  const companyName = companyRes.data?.name ?? 'Empresa'

  const rows = (docsRes.data as DbEntityDocument[] ?? [])
    .filter((row) => row.renewal_frequency !== 'once')
    .map((row) => {
      const expiryDate = row.expiry_date ? parseDateOnly(row.expiry_date) : undefined
      const status = expiryDate ? computeDocumentStatus(expiryDate, alertDays) : row.status

      let entityLabel = row.entity_id
      let entityHref = '/app/documentos'
      if (row.entity_type === 'vehicle') {
        entityLabel = vehicleMap.get(row.entity_id) ?? row.entity_id
        entityHref = `/app/flota/${row.entity_id}`
      } else if (row.entity_type === 'driver') {
        entityLabel = driverMap.get(row.entity_id) ?? row.entity_id
        entityHref = `/app/choferes/${row.entity_id}`
      } else if (row.entity_type === 'company') {
        entityLabel = companyName
        entityHref = '/app/configuracion/empresa'
      }

      return {
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityLabel,
        entityHref,
        documentName: row.name,
        expiryDate,
        status,
        daysUntilExpiry: expiryDate ? daysUntilExpiry(expiryDate) : undefined,
        notes: row.notes ?? undefined,
      }
    })
    .filter((row) => row.status === 'expiring_soon' || row.status === 'expired')

  return {
    documents: sortExpiringDocumentRows(rows),
    alertDaysBefore: alertDays,
  }
})

export function sortExpiringDocumentRows(rows: ExpiringDocumentRow[]): ExpiringDocumentRow[] {
  const statusOrder: Record<ExpiringDocumentRow['status'], number> = {
    expired: 0,
    expiring_soon: 1,
    valid: 2,
    missing: 3,
  }

  return [...rows].sort((a, b) => {
    const byStatus = statusOrder[a.status] - statusOrder[b.status]
    if (byStatus !== 0) return byStatus
    const da = a.expiryDate?.getTime() ?? 0
    const db = b.expiryDate?.getTime() ?? 0
    return da - db
  })
}
