import { requireSession } from '@/lib/auth/session'
import { getExpiringDocuments } from '@/lib/data/documents'
import { AppShell } from '@/components/app-shell'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [{ profile }, expiring] = await Promise.all([
    requireSession(),
    getExpiringDocuments(),
  ])

  return (
    <AppShell
      profile={profile}
      notifications={expiring.documents}
      alertDaysBefore={expiring.alertDaysBefore}
    >
      {children}
    </AppShell>
  )
}
