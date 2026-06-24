'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { TripSortColumn, TripSortDirection } from '@/lib/trips/list-filters'

type TripSortableHeadProps = {
  label: string
  column: TripSortColumn
  activeColumn: TripSortColumn
  activeDirection: TripSortDirection
  onSort: (column: TripSortColumn) => void
  className?: string
}

export function TripSortableHead({
  label,
  column,
  activeColumn,
  activeDirection,
  onSort,
  className,
}: TripSortableHeadProps) {
  const active = activeColumn === column

  return (
    <TableHead className={cn('px-2', className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex max-w-full items-center gap-1 text-left text-sm font-medium hover:text-foreground',
          className?.includes('text-center') && 'mx-auto justify-center',
          className?.includes('text-right') && 'ml-auto justify-end'
        )}
      >
        <span className="truncate">{label}</span>
        {active ? (
          activeDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}
      </button>
    </TableHead>
  )
}
