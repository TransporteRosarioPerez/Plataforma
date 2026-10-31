import { getAccounts, getCategories, getCheques, getForecastItems, getTransactions } from '@/lib/tesoreria/server/data'
import { accountBalances, monthKey } from '@/lib/tesoreria/summary'
import { previousMonths } from '@/lib/tesoreria/closing'
import { ProyeccionView, type ForecastSuggestion } from '@/components/tesoreria/proyeccion-view'

export default async function ProyeccionPage() {
  const [accounts, categories, txs, cheques, items] = await Promise.all([
    getAccounts(),
    getCategories(),
    getTransactions(),
    getCheques(),
    getForecastItems(),
  ])
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const current = today.slice(0, 7)

  // Sugerencias: categorías con movimientos en cada uno de los últimos 3 meses completos → promedio mensual.
  const last3 = previousMonths(current, 4).slice(1)
  const catName = new Map(categories.map((c) => [c.id, c]))
  const byCat = new Map<string, Map<string, number>>()
  for (const t of txs) {
    if (t.isInternal || !t.categoryId) continue
    const m = monthKey(t.txDate)
    if (!last3.includes(m)) continue
    const perMonth = byCat.get(t.categoryId) ?? new Map<string, number>()
    perMonth.set(m, (perMonth.get(m) ?? 0) + t.amount)
    byCat.set(t.categoryId, perMonth)
  }
  const already = new Set(items.filter((i) => i.categoryId).map((i) => i.categoryId))
  const suggestions: ForecastSuggestion[] = [...byCat.entries()]
    .filter(([id, perMonth]) => perMonth.size === 3 && !already.has(id) && catName.get(id)?.kind !== 'internal')
    .map(([id, perMonth]) => ({
      categoryId: id,
      name: catName.get(id)?.name ?? 'Categoría',
      monthlyAverage: Math.round([...perMonth.values()].reduce((a, v) => a + v, 0) / 3),
    }))
    .sort((a, b) => Math.abs(b.monthlyAverage) - Math.abs(a.monthlyAverage))
    .slice(0, 8)

  return (
    <ProyeccionView
      accounts={accounts}
      categories={categories}
      balances={accountBalances(accounts, txs)}
      cheques={cheques}
      items={items}
      suggestions={suggestions}
      today={today}
    />
  )
}
