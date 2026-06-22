'use client'

import { Badge } from '@/components/ui/badge'
import { tripStatusLabels, tripStatusColors, type TripStatus } from '@/lib/types'

interface TripStatusBadgeProps {
  status: TripStatus
  size?: 'sm' | 'default'
}

export function TripStatusBadge({ status, size = 'default' }: TripStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${tripStatusColors[status] ?? ''} ${size === 'sm' ? 'text-xs px-2 py-0.5' : ''}`}
    >
      {tripStatusLabels[status] ?? status}
    </Badge>
  )
}
