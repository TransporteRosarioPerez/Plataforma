import { getCompanySettings } from '@/lib/data/company'
import { getWhatsAppProviderStatus } from '@/lib/notifications/whatsapp/config'
import { NotificacionesConfigForm } from '@/components/config/notificaciones-config-form'

export default async function ConfiguracionNotificacionesPage() {
  const company = await getCompanySettings()
  const providerStatus = getWhatsAppProviderStatus()
  return (
    <NotificacionesConfigForm company={company} providerStatus={providerStatus} />
  )
}
