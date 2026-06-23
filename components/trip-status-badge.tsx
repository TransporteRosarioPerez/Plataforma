'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { tripStatusLabels, tripStatusColors, type TripStatus } from '@/lib/types'

interface TripStatusBadgeProps {
  status: TripStatus
  size?: 'sm' | 'default'
  className?: string
}

export function TripStatusBadge({ status, size = 'default', className }: TripStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        tripStatusColors[status] ?? '',
        size === 'sm' && 'text-xs px-2 py-0.5',
        className
      )}
    >
      {tripStatusLabels[status] ?? status}
    </Badge>
  )
}
