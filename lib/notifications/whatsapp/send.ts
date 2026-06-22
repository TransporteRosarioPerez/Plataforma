import { getWhatsAppConfig } from './config'
import { sendViaTwilio } from './twilio'
import { sendViaMeta } from './meta'

export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getWhatsAppConfig()
  if (!config) {
    return { ok: false, error: 'Proveedor WhatsApp no configurado (revisá variables de entorno)' }
  }

  if (config.provider === 'meta') {
    return sendViaMeta(config, to, body)
  }

  return sendViaTwilio(config, to, body)
}

export async function sendWhatsAppToMany(
  phones: string[],
  body: string
): Promise<{ sent: number; failed: string[] }> {
  const failed: string[] = []
  let sent = 0

  for (const phone of phones) {
    const result = await sendWhatsAppMessage(phone, body)
    if (result.ok) sent++
    else failed.push(`${phone}: ${result.error}`)
  }

  return { sent, failed }
}
