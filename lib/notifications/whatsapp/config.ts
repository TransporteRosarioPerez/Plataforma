export type WhatsAppProvider = 'twilio' | 'meta'

export type WhatsAppConfig = {
  provider: WhatsAppProvider
  twilio?: {
    accountSid: string
    authToken: string
    from: string
  }
  meta?: {
    accessToken: string
    phoneNumberId: string
  }
}

export type WhatsAppProviderStatus = {
  provider: WhatsAppProvider | null
  configured: boolean
  missing: string[]
}

export function getWhatsAppProviderStatus(): WhatsAppProviderStatus {
  const provider = (process.env.WHATSAPP_PROVIDER ?? 'twilio') as WhatsAppProvider
  const missing: string[] = []

  if (provider === 'meta') {
    if (!process.env.WHATSAPP_ACCESS_TOKEN) missing.push('WHATSAPP_ACCESS_TOKEN')
    if (!process.env.WHATSAPP_PHONE_NUMBER_ID) missing.push('WHATSAPP_PHONE_NUMBER_ID')
    return { provider: 'meta', configured: missing.length === 0, missing }
  }

  if (!process.env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID')
  if (!process.env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN')
  if (!process.env.TWILIO_WHATSAPP_FROM) missing.push('TWILIO_WHATSAPP_FROM')

  return { provider: 'twilio', configured: missing.length === 0, missing }
}

export function getWhatsAppConfig(): WhatsAppConfig | null {
  const status = getWhatsAppProviderStatus()
  if (!status.configured || !status.provider) return null

  if (status.provider === 'meta') {
    return {
      provider: 'meta',
      meta: {
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
      },
    }
  }

  return {
    provider: 'twilio',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      from: normalizeWhatsAppAddress(process.env.TWILIO_WHATSAPP_FROM!),
    },
  }
}

/** E.164 sin + → whatsapp:+5493411234567 para Twilio */
export function normalizeWhatsAppAddress(raw: string, prefix = 'whatsapp:'): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('whatsapp:')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  return `${prefix}+${digits}`
}

/** Número destino solo dígitos (Meta) o whatsapp:+... (Twilio) */
export function formatRecipientPhone(phone: string, provider: WhatsAppProvider): string {
  const digits = phone.replace(/\D/g, '')
  if (provider === 'twilio') return normalizeWhatsAppAddress(digits)
  return digits
}
