import { formatRecipientPhone, type WhatsAppConfig } from './config'

export async function sendViaTwilio(
  config: WhatsAppConfig,
  to: string,
  body: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const twilio = config.twilio
  if (!twilio) return { ok: false, error: 'Twilio no configurado' }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`
  const params = new URLSearchParams({
    From: twilio.from,
    To: formatRecipientPhone(to, 'twilio'),
    Body: body,
  })

  const auth = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `Twilio ${res.status}: ${text.slice(0, 200)}` }
  }

  return { ok: true }
}
