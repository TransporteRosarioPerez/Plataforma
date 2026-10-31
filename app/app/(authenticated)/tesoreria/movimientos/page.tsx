import { getAccounts, getCategories, getTransactions, type TransactionFilters } from '@/lib/tesoreria/server/data'
import { MovimientosView } from '@/components/tesoreria/movimientos-view'

type SearchParams = Promise<Record<string, string | undefined>>

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v)

export default async function MovimientosPage({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams
  const filters: TransactionFilters = {
    from: isDate(p.desde) ? p.desde : undefined,
    to: isDate(p.hasta) ? p.hasta : undefined,
    accountId: isUuid(p.cuenta) ? p.cuenta : undefined,
    categoryId: p.categoria === 'none' ? 'none' : isUuid(p.categoria) ? p.categoria : undefined,
    scope: p.ambito === 'empresa' || p.ambito === 'personal' || p.ambito === 'none' ? p.ambito : undefined,
    classification: p.estado === 'pending' || p.estado === 'auto' || p.estado === 'manual' ? p.estado : undefined,
    search: p.q?.trim() ? p.q.trim().slice(0, 80) : undefined,
  }
  // Sin filtro de fechas, mostramos los últimos 90 días para no traer todo el histórico.
  if (!filters.from && !filters.to) {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    filters.from = d.toISOString().slice(0, 10)
  }

  const [accounts, categories, transactions] = await Promise.all([
    getAccounts(),
    getCategories(),
    getTransactions(filters),
  ])

  return (
    <MovimientosView
      accounts={accounts}
      categories={categories}
      transactions={transactions}
      filters={{
        desde: filters.from ?? '',
        hasta: filters.to ?? '',
        cuenta: filters.accountId ?? '',
        categoria: filters.categoryId ?? '',
        ambito: filters.scope ?? '',
        estado: filters.classification ?? '',
        q: filters.search ?? '',
      }}
    />
  )
}
