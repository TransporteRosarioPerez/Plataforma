'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { tripStatusLabels, tripStatusShortLabels, tripStatusColors, type TripStatus } from '@/lib/types'

interface TripStatusBadgeProps {
  status: TripStatus
  size?: 'sm' | 'default'
  compact?: boolean
  className?: string
}

export function TripStatusBadge({
  status,
  size = 'default',
  compact = false,
  className,
}: TripStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        tripStatusColors[status] ?? '',
        size === 'sm' && 'text-[10px] px-1.5 py-0 leading-4',
        !compact && size === 'sm' && 'text-xs px-2 py-0.5',
        compact && 'whitespace-nowrap',
        className
      )}
    >
      {(compact ? tripStatusShortLabels : tripStatusLabels)[status] ?? status}
    </Badge>
  )
}
