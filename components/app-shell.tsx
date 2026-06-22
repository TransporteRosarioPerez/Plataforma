'use client'

import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import type { ExpiringDocumentRow } from '@/lib/data/documents'
import type { SessionProfile } from '@/lib/types'

type AppShellProps = {
  children: React.ReactNode
  profile: SessionProfile
  notifications: ExpiringDocumentRow[]
  alertDaysBefore: number
}

export function AppShell({ children, profile, notifications, alertDaysBefore }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar userRole={profile.role} />
      <SidebarInset>
        <AppHeader
          profile={profile}
          notifications={notifications}
          alertDaysBefore={alertDaysBefore}
        />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
