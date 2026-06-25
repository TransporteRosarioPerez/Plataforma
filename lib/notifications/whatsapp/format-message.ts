import { APP_NAME } from '@/lib/brand'
import type { DocumentAlertItem } from '@/lib/notifications/types'
import { entityTypeLabels, entityTypeOrder, groupByEntityType } from '@/lib/documents/entity-labels'
import { formatDateOnlyDisplay, parseDateOnly } from '@/lib/documents/dates'

function formatAlertLine(alert: DocumentAlertItem): string {
  const entity =
    alert.entityType === 'vehicle'
      ? `Patente ${alert.entityLabel}`
      : alert.entityType === 'company'
        ? alert.entityLabel
        : alert.entityLabel

  const expiry =
    alert.expiryDate != null
      ? formatDateOnlyDisplay(parseDateOnly(alert.expiryDate))
      : 'sin fecha'

  let timing: string
  if (alert.daysUntilExpiry != null) {
    timing =
      alert.daysUntilExpiry === 0
        ? 'vence hoy'
        : `vence ${expiry} (${alert.daysUntilExpiry} días)`
  } else {
    timing = `vence ${expiry}`
  }

  return `• ${alert.documentType} — ${entity} — ${timing}`
}

export function formatDocumentAlertsMessage(
  companyName: string,
  alerts: DocumentAlertItem[]
): string {
  const groups = groupByEntityType(alerts)
  const sections: string[] = [
    `*${APP_NAME}* — ${companyName}`,
    '',
    'Documentos por vencer (aviso preventivo):',
  ]

  for (const entityType of entityTypeOrder) {
    const items = groups[entityType]
    if (items.length === 0) continue
    sections.push('')
    sections.push(`*${entityTypeLabels[entityType]}*`)
    sections.push(...items.map(formatAlertLine))
  }

  return sections.join('\n')
}
