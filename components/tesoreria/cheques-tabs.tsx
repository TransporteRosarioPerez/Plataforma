'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ChequesTabs({ initial, emitted, received }: { initial: string; emitted: ReactNode; received: ReactNode }) {
  const router = useRouter()
  return (
    <Tabs defaultValue={initial} onValueChange={(v) => router.replace(`/app/tesoreria/cheques?tab=${v}`, { scroll: false })}>
      <TabsList>
        <TabsTrigger value="emitidos">Emitidos</TabsTrigger>
        <TabsTrigger value="recibidos">Recibidos</TabsTrigger>
      </TabsList>
      <TabsContent value="emitidos" className="mt-4">{emitted}</TabsContent>
      <TabsContent value="recibidos" className="mt-4">{received}</TabsContent>
    </Tabs>
  )
}
