import { formatRecipientPhone, type WhatsAppConfig } from './config'

export async function sendViaMeta(
  config: WhatsAppConfig,
  to: string,
  body: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const meta = config.meta
  if (!meta) return { ok: false, error: 'Meta Cloud API no configurada' }

  const url = `https://graph.facebook.com/v21.0/${meta.phoneNumberId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${meta.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formatRecipientPhone(to, 'meta'),
      type: 'text',
      text: { body },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `Meta ${res.status}: ${text.slice(0, 200)}` }
  }

  return { ok: true }
}
