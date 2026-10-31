import type { Metadata } from 'next'
import { Landmark } from 'lucide-react'
import { requireSuperadmin } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TesoreriaNav } from '@/components/tesoreria/tesoreria-nav'

export const metadata: Metadata = { title: 'Tesorería' }

export default async function TesoreriaLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin()
  const supabase = await createClient()
  const { count } = await supabase
    .from('treasury_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('classification', 'pending')
    .is('deleted_at', null)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Tesorería</h1>
          <p className="text-sm text-muted-foreground">
            Flujo de fondos real: Macro, Nación, Mercado Pago y efectivo
          </p>
        </div>
      </div>
      <TesoreriaNav pendingCount={count ?? 0} />
      {children}
    </div>
  )
}
