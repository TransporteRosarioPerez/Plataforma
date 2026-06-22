'use client'

import Link from 'next/link'
import { Bell, CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDocumentExpiryAlert } from '@/lib/documents/dates'
import { entityTypeLabels } from '@/lib/documents/entity-labels'
import { documentStatusColors, documentStatusLabels } from '@/lib/documents/status'
import type { ExpiringDocumentRow } from '@/lib/data/documents'

const PREVIEW_LIMIT = 12

type NavNotificationsBellProps = {
  notifications: ExpiringDocumentRow[]
  alertDaysBefore: number
}

export function NavNotificationsBell({
  notifications,
  alertDaysBefore,
}: NavNotificationsBellProps) {
  const count = notifications.length
  const preview = notifications.slice(0, PREVIEW_LIMIT)
  const expiredCount = notifications.filter((n) => n.status === 'expired').length
  const expiringCount = count - expiredCount

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count > 0 ? `${count} alertas de vencimiento` : 'Notificaciones'}
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="px-4 py-3">
          <DropdownMenuLabel className="p-0 text-base">Alertas</DropdownMenuLabel>
          <p className="text-xs text-muted-foreground mt-1">
            Avisos preventivos hasta {alertDaysBefore} día{alertDaysBefore === 1 ? '' : 's'} antes
            del vencimiento, igual que WhatsApp.
          </p>
          {count > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {expiredCount > 0 && (
                <Badge variant="outline" className={documentStatusColors.expired}>
                  {expiredCount} vencido{expiredCount === 1 ? '' : 's'}
                </Badge>
              )}
              {expiringCount > 0 && (
                <Badge variant="outline" className={documentStatusColors.expiring_soon}>
                  {expiringCount} por vencer
                </Badge>
              )}
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />

        {count === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600/70" />
            <p className="text-sm font-medium">Todo al día</p>
            <p className="text-xs text-muted-foreground">
              No hay documentos vencidos ni próximos a vencer en los próximos {alertDaysBefore} días.
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[320px]">
              <ul className="py-1">
                {preview.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.entityHref}
                      className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-snug line-clamp-2">
                          {item.documentName}
                        </span>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] ${documentStatusColors[item.status]}`}
                        >
                          {documentStatusLabels[item.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entityTypeLabels[item.entityType]} · {item.entityLabel}
                      </p>
                      <p
                        className={`text-xs font-medium ${
                          item.status === 'expired' ? 'text-destructive' : 'text-orange-700 dark:text-orange-400'
                        }`}
                      >
                        {formatDocumentExpiryAlert(
                          item.status === 'expired' ? 'expired' : 'expiring_soon',
                          item.expiryDate,
                          item.daysUntilExpiry
                        )}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </ScrollArea>

            {count > PREVIEW_LIMIT && (
              <p className="px-4 py-2 text-xs text-muted-foreground border-t">
                Mostrando {PREVIEW_LIMIT} de {count} alertas
              </p>
            )}

            <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                <Link href="/app/documentos">
                  Ver todos los vencimientos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
