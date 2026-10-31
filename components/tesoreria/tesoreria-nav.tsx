'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/app/tesoreria', label: 'Resumen', exact: true },
  { href: '/app/tesoreria/movimientos', label: 'Movimientos' },
  { href: '/app/tesoreria/pendientes', label: 'Pendientes' },
  { href: '/app/tesoreria/cheques', label: 'Cheques' },
  { href: '/app/tesoreria/proyeccion', label: 'Proyección' },
  { href: '/app/tesoreria/cierres', label: 'Cierres' },
  { href: '/app/tesoreria/importar', label: 'Importar' },
  { href: '/app/tesoreria/configuracion', label: 'Configuración' },
]

export function TesoreriaNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
            {item.href.endsWith('/pendientes') && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                {pendingCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
