import { getAccounts, getCategories, getCounterparties, getRules } from '@/lib/tesoreria/server/data'
import { ConfigView } from '@/components/tesoreria/config-view'

type SearchParams = Promise<{ tab?: string }>

export default async function TesoreriaConfigPage({ searchParams }: { searchParams: SearchParams }) {
  const { tab } = await searchParams
  const [accounts, categories, rules, counterparties] = await Promise.all([
    getAccounts(),
    getCategories(),
    getRules(),
    getCounterparties(),
  ])
  return (
    <ConfigView
      initialTab={tab ?? 'cuentas'}
      accounts={accounts}
      categories={categories}
      rules={rules}
      counterparties={counterparties}
    />
  )
}
