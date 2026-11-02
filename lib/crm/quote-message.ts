/** Texto de la cotización para mandar por WhatsApp o mail (editable antes de enviar). */
import { FREQUENCY_LABELS, LOAD_TYPE_LABELS, SERVICE_LABELS } from './constants'
import type { CrmQuote } from './types'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export function formatDateAr(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function quoteCode(n: number): string {
  return `COT-${String(n).padStart(4, '0')}`
}

export function buildQuoteMessage(
  q: Pick<CrmQuote, 'number' | 'contactName' | 'serviceType' | 'loadType' | 'pallets' | 'weightKg' | 'origin' | 'destination' | 'loadDate' | 'frequency' | 'quotedAmount' | 'validUntil'>,
  opts: { companyName?: string; plusIva?: boolean } = {},
): string {
  const firstName = q.contactName?.trim().split(/\s+/)[0]
  const lines: string[] = []
  lines.push(`Hola${firstName ? ` ${firstName}` : ''}, te paso la cotización ${quoteCode(q.number)} de Transporte Rosario Perez:`)
  lines.push('')
  const service = [q.serviceType ? SERVICE_LABELS[q.serviceType] : null, q.loadType ? LOAD_TYPE_LABELS[q.loadType] : null]
    .filter(Boolean)
    .join(' · ')
  const size = [q.pallets ? `${q.pallets} pallets` : null, q.weightKg ? `${new Intl.NumberFormat('es-AR').format(q.weightKg)} kg` : null]
    .filter(Boolean)
    .join(', ')
  if (service || size) lines.push(`• Servicio: ${[service, size ? `(${size})` : ''].filter(Boolean).join(' ')}`)
  if (q.origin || q.destination) lines.push(`• Recorrido: ${q.origin ?? 'Buenos Aires'} → ${q.destination ?? 'a definir'}`)
  if (q.loadDate) lines.push(`• Fecha de carga: ${formatDateAr(q.loadDate)}`)
  if (q.frequency && q.frequency !== 'unica') lines.push(`• Frecuencia: ${FREQUENCY_LABELS[q.frequency]}`)
  if (q.quotedAmount != null) {
    lines.push(`• Precio: ${money.format(q.quotedAmount)}${opts.plusIva === false ? ' (IVA incluido)' : ' + IVA'}${q.frequency && q.frequency !== 'unica' ? ' por viaje' : ''}`)
  }
  if (q.validUntil) lines.push(`• Validez: hasta el ${formatDateAr(q.validUntil)}`)
  lines.push('')
  lines.push(
    'Salimos semanalmente desde Buenos Aires con semis térmicos (equipos Thermo King) y GPS con monitoreo de temperatura en todo el recorrido. ' +
      'El servicio no incluye seguro sobre la mercadería salvo acuerdo por escrito.',
  )
  lines.push('')
  lines.push('Quedamos a disposición. ¡Gracias por consultarnos!')
  return lines.join('\n')
}

/** wa.me sólo acepta dígitos con código de país. */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  if (!d.startsWith('54')) d = `549${d}`
  else if (!d.startsWith('549')) d = `549${d.slice(2)}`
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}

export function mailtoLink(email: string | null | undefined, subject: string, body: string): string | null {
  if (!email) return null
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
