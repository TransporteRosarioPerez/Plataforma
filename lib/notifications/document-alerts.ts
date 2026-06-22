import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { computeDocumentStatus, daysUntilExpiry } from '@/lib/documents/status'
import type { DbCompanySettings } from '@/lib/db/mappers'
import { shouldNotifyDocument } from '@/lib/notifications/alert-milestones'
import { getWhatsAppConfig, getWhatsAppProviderStatus } from '@/lib/notifications/whatsapp/config'
import { formatDocumentAlertsMessage } from '@/lib/notifications/whatsapp/format-message'
import { sendWhatsAppToMany } from '@/lib/notifications/whatsapp/send'
import type { DocumentAlertItem } from '@/lib/notifications/types'

export type { DocumentAlertItem } from '@/lib/notifications/types'

export type SendDocumentAlertsResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  alertsCount?: number
  messagesSent?: number
  provider?: string
  errors?: string[]
}

export async function refreshDocumentStatuses(supabase: ReturnType<typeof createServiceRoleClient>) {
  const [{ data: docs, error }, { data: company }] = await Promise.all([
    supabase.from('entity_documents').select('id, expiry_date').is('deleted_at', null),
    supabase.from('company_settings').select('alert_days_before').limit(1).maybeSingle(),
  ])

  if (error) throw new Error(error.message)

  const alertDays = company?.alert_days_before ?? 7

  for (const doc of docs ?? []) {
    const expiryDate = doc.expiry_date ? new Date(doc.expiry_date as string) : null
    const status = computeDocumentStatus(expiryDate, alertDays)

    await supabase.from('entity_documents').update({ status }).eq('id', doc.id)
  }
}

export async function sendDocumentAlerts(): Promise<SendDocumentAlertsResult> {
  const supabase = createServiceRoleClient()
  const providerStatus = getWhatsAppProviderStatus()

  const { data: company, error: companyError } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .single()

  if (companyError || !company) {
    return { ok: false, reason: 'company_settings no encontrado' }
  }

  const settings = company as DbCompanySettings
  const alertDaysBefore = settings.alert_days_before ?? 7

  if (!settings.alert_enabled) {
    return { ok: true, skipped: true, reason: 'alertas desactivadas' }
  }

  if (!providerStatus.configured) {
    return {
      ok: false,
      reason: `Faltan variables: ${providerStatus.missing.join(', ')}`,
      provider: providerStatus.provider ?? undefined,
    }
  }

  const phones = settings.alert_whatsapp_phones ?? []
  if (phones.length === 0) {
    return { ok: false, reason: 'sin teléfonos destino configurados' }
  }

  await refreshDocumentStatuses(supabase)

  const { data: docs, error: docsError } = await supabase
    .from('entity_documents')
    .select('id, entity_type, entity_id, name, expiry_date, status, notes')
    .is('deleted_at', null)
    .eq('is_current', true)
    .eq('status', 'expiring_soon')

  if (docsError) return { ok: false, reason: docsError.message }

  const [vehiclesRes, driversRes] = await Promise.all([
    supabase.from('vehicles').select('id, plate').is('deleted_at', null),
    supabase.from('drivers').select('id, name').is('deleted_at', null),
  ])

  const vehicleMap = new Map((vehiclesRes.data ?? []).map((v) => [v.id, v.plate as string]))
  const driverMap = new Map((driversRes.data ?? []).map((d) => [d.id, d.name as string]))

  const pendingAlerts: DocumentAlertItem[] = []

  for (const doc of docs ?? []) {
    const expiryDateStr = doc.expiry_date as string | null
    if (!expiryDateStr) continue

    const expiryDate = new Date(expiryDateStr)
    const daysLeft = daysUntilExpiry(expiryDate)

    const { notify, milestone } = await shouldNotifyDocument(
      supabase,
      doc.id as string,
      daysLeft,
      alertDaysBefore
    )
    if (!notify || !milestone) continue

    const entityType = doc.entity_type as string
    const entityId = doc.entity_id as string
    let entityLabel = entityId
    if (entityType === 'vehicle') entityLabel = vehicleMap.get(entityId) ?? entityId
    if (entityType === 'driver') entityLabel = driverMap.get(entityId) ?? entityId
    if (entityType === 'company') entityLabel = settings.name

    pendingAlerts.push({
      documentId: doc.id as string,
      entityType,
      entityId,
      entityLabel,
      documentType: doc.name as string,
      status: doc.status as string,
      expiryDate: expiryDateStr,
      daysUntilExpiry: daysLeft,
      notes: (doc.notes as string | null) ?? null,
      milestone,
    })
  }

  if (pendingAlerts.length === 0) {
    return { ok: true, skipped: true, reason: 'sin alertas preventivas hoy', alertsCount: 0 }
  }

  const config = getWhatsAppConfig()
  const message = formatDocumentAlertsMessage(settings.name, pendingAlerts)
  const { sent, failed } = await sendWhatsAppToMany(phones, message)

  if (sent === 0) {
    return {
      ok: false,
      reason: 'no se pudo enviar ningún mensaje',
      alertsCount: pendingAlerts.length,
      provider: config?.provider,
      errors: failed,
    }
  }

  const channel = config?.provider === 'meta' ? 'whatsapp_meta' : 'whatsapp_twilio'

  for (const alert of pendingAlerts) {
    await supabase.from('notification_log').insert({
      document_id: alert.documentId,
      channel,
      status: 'sent',
      payload: alert,
    })
  }

  return {
    ok: true,
    alertsCount: pendingAlerts.length,
    messagesSent: sent,
    provider: config?.provider,
    errors: failed.length > 0 ? failed : undefined,
  }
}
