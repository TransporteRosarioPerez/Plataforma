import { getAccounts, getCategories, getCheques, getTransactions } from '@/lib/tesoreria/server/data'
import { chequeOutlook } from '@/lib/tesoreria/cheques'
import { accountBalances, monthKey, summarize, type ScopeFilter } from '@/lib/tesoreria/summary'
import { ResumenView } from '@/components/tesoreria/resumen-view'

type SearchParams = Promise<{ mes?: string; ambito?: string }>

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export default async function TesoreriaResumenPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const [accounts, categories, all, cheques] = await Promise.all([
    getAccounts(),
    getCategories(),
    getTransactions(),
    getCheques(),
  ])

  const months = [...new Set(all.map((t) => monthKey(t.txDate)))].sort()
  const latest = months[months.length - 1]
  const now = new Date()
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : latest ?? current
  const scope: ScopeFilter =
    params.ambito === 'empresa' || params.ambito === 'personal' ? params.ambito : 'todo'

  const inMonth = all.filter((t) => monthKey(t.txDate) === month)
  const firstChartMonth = shiftMonth(month, -5)
  const inChart = all.filter((t) => {
    const k = monthKey(t.txDate)
    return k >= firstChartMonth && k <= month
  })

  return (
    <ResumenView
      month={month}
      scope={scope}
      availableMonths={months.length ? months : [current]}
      summary={summarize(inMonth, categories, scope)}
      chart={summarize(inChart, categories, scope).byMonth}
      balances={accountBalances(accounts, all)}
      hasData={all.length > 0}
      cheques={chequeOutlook(cheques, new Date().toISOString().slice(0, 10))}
    />
  )
}
