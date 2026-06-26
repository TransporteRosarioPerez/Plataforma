import { getExpiringDocuments } from '@/lib/data/documents'
import { NavNotificationsBell } from '@/components/notifications/nav-notifications-bell'

export async function HeaderNotifications() {
  const { documents, alertDaysBefore } = await getExpiringDocuments()

  return (
    <NavNotificationsBell
      notifications={documents}
      alertDaysBefore={alertDaysBefore}
    />
  )
}
