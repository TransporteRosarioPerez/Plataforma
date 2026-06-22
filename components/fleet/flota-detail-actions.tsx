'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VehicleSheet } from '@/components/fleet/vehicle-sheet'
import type { Vehicle } from '@/lib/types'

type FlotaDetailActionsProps = {
  vehicle: Vehicle
}

export function FlotaDetailActions({ vehicle }: FlotaDetailActionsProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) router.refresh()
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </Button>
      <VehicleSheet open={open} onOpenChange={handleOpenChange} vehicle={vehicle} />
    </>
  )
}
