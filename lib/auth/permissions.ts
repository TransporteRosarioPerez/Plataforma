import type { UserRole } from '@/lib/types'

export function canAccessInvoices(role: UserRole): boolean {
  return role === 'superadmin'
}

export function canAccessReports(role: UserRole): boolean {
  return role === 'superadmin'
}

export const SUPERADMIN_ONLY_ROUTES = [
  '/app/facturas',
  '/app/reportes',
  '/app/papelera',
  '/app/equipo',
  '/app/configuracion',
] as const

export function routeRequiresSuperadmin(pathname: string): boolean {
  return SUPERADMIN_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}
