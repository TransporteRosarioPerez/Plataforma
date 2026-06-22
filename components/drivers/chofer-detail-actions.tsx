'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DriverSheet } from '@/components/drivers/driver-sheet'
import type { Driver } from '@/lib/types'

type ChoferDetailActionsProps = {
  driver: Driver
}

export function ChoferDetailActions({ driver }: ChoferDetailActionsProps) {
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
      <DriverSheet open={open} onOpenChange={handleOpenChange} driver={driver} />
    </>
  )
}
