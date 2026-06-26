'use client'

import type { ReactNode } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import type { SessionProfile } from '@/lib/types'

type AppShellProps = {
  children: React.ReactNode
  profile: SessionProfile
  notifications: ReactNode
}

export function AppShell({ children, profile, notifications }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar userRole={profile.role} />
      <SidebarInset>
        <AppHeader profile={profile} notifications={notifications} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
