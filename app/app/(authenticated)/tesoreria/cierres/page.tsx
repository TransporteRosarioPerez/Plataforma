import { getAccounts, getCashCounts, getMonthCloses, getTransactions } from '@/lib/tesoreria/server/data'
import { buildCloseRows, previousMonths, systemBalanceAt } from '@/lib/tesoreria/closing'
import { CierresView } from '@/components/tesoreria/cierres-view'

export default async function CierresPage() {
  const [accounts, txs, closes, counts] = await Promise.all([
    getAccounts(),
    getTransactions(),
    getMonthCloses(),
    getCashCounts(),
  ])
  const now = new Date()
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  // Mes actual + 5 anteriores, del más reciente al más viejo.
  const months = previousMonths(current, 6)
  const rows = buildCloseRows(accounts, txs, closes, counts, months)
  const today = now.toISOString().slice(0, 10)
  const cash = accounts.find((a) => a.kind === 'cash' && a.isActive) ?? null

  return (
    <CierresView
      accounts={accounts}
      rows={rows}
      currentMonth={current}
      history={closes}
      cashAccount={cash}
      cashCounts={counts.filter((c) => c.accountId === cash?.id)}
      cashSystemToday={cash ? systemBalanceAt(cash, txs, today) : 0}
      today={today}
    />
  )
}
