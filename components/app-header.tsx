'use client'

import { LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NavNotificationsBell } from '@/components/notifications/nav-notifications-bell'
import { signOut } from '@/lib/actions/auth'
import type { ExpiringDocumentRow } from '@/lib/data/documents'
import type { SessionProfile } from '@/lib/types'

type AppHeaderProps = {
  profile: SessionProfile
  notifications: ExpiringDocumentRow[]
  alertDaysBefore: number
}

export function AppHeader({ profile, notifications, alertDaysBefore }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-card px-6">
      <SidebarTrigger className="-ml-2">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Alternar menú</span>
      </SidebarTrigger>

      <div className="flex-1" />

      <NavNotificationsBell
        notifications={notifications}
        alertDaysBefore={alertDaysBefore}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <span className="text-sm font-medium">
                {profile.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <span className="hidden sm:inline-block text-sm font-medium">{profile.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{profile.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{profile.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
