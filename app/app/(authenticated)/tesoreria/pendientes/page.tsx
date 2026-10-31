import { getAccounts, getCategories, getPendingTransactions, getTransactions } from '@/lib/tesoreria/server/data'
import { findInternalPairs } from '@/lib/tesoreria/engine'
import { PendientesView } from '@/components/tesoreria/pendientes-view'

export default async function PendientesPage() {
  const since = new Date()
  since.setDate(since.getDate() - 120)
  const [accounts, categories, pending, recent] = await Promise.all([
    getAccounts(),
    getCategories(),
    getPendingTransactions(),
    getTransactions({ from: since.toISOString().slice(0, 10), includeInternal: false }),
  ])

  // Sólo sugerimos pares donde al menos uno esté sin clasificar o sea una transferencia genérica.
  const pairs = findInternalPairs(recent).filter((p) => {
    const out = recent.find((t) => t.id === p.outId)
    const inc = recent.find((t) => t.id === p.inId)
    return out?.classification === 'pending' || inc?.classification === 'pending'
  })
  const byId = new Map(recent.map((t) => [t.id, t]))

  return (
    <PendientesView
      accounts={accounts}
      categories={categories}
      pending={pending}
      pairs={pairs.map((p) => ({ ...p, out: byId.get(p.outId)!, in: byId.get(p.inId)! }))}
    />
  )
}
