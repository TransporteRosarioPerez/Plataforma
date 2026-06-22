export const EXPIRY_BEFORE_ISSUE_MESSAGE =
  'La fecha de vencimiento no puede ser anterior a la de emisión'

/** @deprecated Usar EXPIRY_BEFORE_ISSUE_MESSAGE */
export const ISSUE_AFTER_EXPIRY_MESSAGE = EXPIRY_BEFORE_ISSUE_MESSAGE

/** Compara fechas ISO (YYYY-MM-DD). Devuelve mensaje de error o null si es válido. */
export function validateIssueBeforeExpiry(
  issueDate?: string | null,
  expiryDate?: string | null
): string | null {
  const issue = issueDate?.trim()
  const expiry = expiryDate?.trim()
  if (!issue || !expiry) return null
  if (expiry < issue) return EXPIRY_BEFORE_ISSUE_MESSAGE
  return null
}

const expiryDateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatExpiryTiming(daysUntilExpiry?: number): string {
  if (daysUntilExpiry == null) return ''
  if (daysUntilExpiry < 0) {
    const days = Math.abs(daysUntilExpiry)
    return days === 1 ? 'Venció ayer' : `Venció hace ${days} días`
  }
  if (daysUntilExpiry === 0) return 'Vence hoy'
  if (daysUntilExpiry === 1) return 'Vence mañana'
  return `Vence en ${daysUntilExpiry} días`
}

/** Mensaje de alerta preventiva (navbar / WhatsApp) para documentos por vencer. */
export function formatDocumentExpiryAlert(
  status: 'expiring_soon' | 'expired',
  expiryDate?: Date,
  daysUntilExpiry?: number
): string {
  if (status === 'expired') {
    const timing = formatExpiryTiming(daysUntilExpiry)
    return timing ? `Documento vencido — ${timing.toLowerCase()}` : 'Documento vencido'
  }

  const formattedDate = expiryDate ? expiryDateFormatter.format(expiryDate) : null

  if (daysUntilExpiry === 0) {
    return formattedDate
      ? `Pronto a vencer — vence hoy (${formattedDate})`
      : 'Pronto a vencer — vence hoy'
  }
  if (daysUntilExpiry === 1) {
    return formattedDate
      ? `Pronto a vencer — vence mañana (${formattedDate})`
      : 'Pronto a vencer — vence mañana'
  }
  if (formattedDate && daysUntilExpiry != null) {
    return `Pronto a vencer — vence ${formattedDate} (en ${daysUntilExpiry} días)`
  }

  return 'Pronto a vencer'
}
