import type { Metadata } from 'next'
import { KanbanSquare } from 'lucide-react'
import { requireSuperadmin } from '@/lib/auth/session'
import { getPendingCount } from '@/lib/crm/server/data'
import { CrmNav } from '@/components/crm/crm-nav'

export const metadata: Metadata = { title: 'CRM' }

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin()
  const pending = await getPendingCount()
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KanbanSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de cotización de WhatsApp, mail y la web, de la bandeja al cierre
          </p>
        </div>
      </div>
      <CrmNav pendingCount={pending} />
      {children}
    </div>
  )
}
