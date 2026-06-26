import { Suspense } from 'react'
import { requireSession } from '@/lib/auth/session'
import { AppShell } from '@/components/app-shell'
import { HeaderNotifications } from '@/components/notifications/header-notifications'
import { NotificationsBellSkeleton } from '@/components/notifications/notifications-bell-skeleton'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireSession()

  return (
    <AppShell
      profile={profile}
      notifications={
        <Suspense fallback={<NotificationsBellSkeleton />}>
          <HeaderNotifications />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  )
}
