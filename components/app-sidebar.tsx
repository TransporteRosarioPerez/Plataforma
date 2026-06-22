'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Truck,
  Users,
  Building2,
  FileText,
  Settings,
  Route,
  UserCircle,
  FileWarning,
  BarChart3,
  Package,
  ArchiveRestore,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from '@/components/ui/sidebar'
import { APP_NAME } from '@/lib/brand'
import { INVENTORY_ENABLED } from '@/lib/features'
import type { UserRole } from '@/lib/types'

const mainNavItems = [
  {
    title: 'Dashboard',
    href: '/app/dashboard',
    icon: LayoutDashboard,
    roles: ['superadmin', 'admin', 'ops', 'accounting']
  },
  {
    title: 'Reportes',
    href: '/app/reportes',
    icon: BarChart3,
    roles: ['superadmin', 'admin', 'accounting']
  },
  {
    title: 'Viajes',
    href: '/app/viajes',
    icon: Route,
    roles: ['superadmin', 'admin', 'ops']
  },
  {
    title: 'Proformas',
    href: '/app/proformas',
    icon: FileText,
    roles: ['superadmin', 'admin', 'ops', 'accounting']
  },
  {
    title: 'Vencimientos',
    href: '/app/documentos',
    icon: FileWarning,
    roles: ['superadmin', 'admin', 'ops']
  }
]

const masterNavItems = [
  {
    title: 'Flota',
    href: '/app/flota',
    icon: Truck,
    roles: ['superadmin', 'admin', 'ops']
  },
  {
    title: 'Choferes',
    href: '/app/choferes',
    icon: UserCircle,
    roles: ['superadmin', 'admin', 'ops']
  },
  {
    title: 'Clientes',
    href: '/app/clientes',
    icon: Building2,
    roles: ['superadmin', 'admin', 'ops', 'accounting']
  },
  // Inventario — oculto mientras INVENTORY_ENABLED = false
  ...(INVENTORY_ENABLED
    ? [{
        title: 'Inventario',
        href: '/app/inventario',
        icon: Package,
        roles: ['superadmin', 'admin', 'ops'] as const,
      }]
    : []),
]

const adminNavItems = [
  {
    title: 'Papelera',
    href: '/app/papelera',
    icon: ArchiveRestore,
    roles: ['superadmin', 'admin']
  },
  {
    title: 'Equipo',
    href: '/app/equipo',
    icon: Users,
    roles: ['superadmin', 'admin']
  },
  {
    title: 'Configuración',
    href: '/app/configuracion',
    icon: Settings,
    roles: ['superadmin', 'admin']
  }
]

type AppSidebarProps = {
  userRole: UserRole
}

export function AppSidebar({ userRole }: AppSidebarProps) {
  const pathname = usePathname()

  const filterByRole = (items: typeof mainNavItems) => {
    return items.filter(item => item.roles.includes(userRole))
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/app/dashboard" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-sidebar-foreground leading-tight">
            {APP_NAME}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filterByRole(mainNavItems).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Maestros</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filterByRole(masterNavItems).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filterByRole(adminNavItems).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
