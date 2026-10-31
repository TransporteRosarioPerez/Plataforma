import { getAccounts, getCategories, getCheques, getTransactions } from '@/lib/tesoreria/server/data'
import { chequeOutlook, isChequeDebit } from '@/lib/tesoreria/cheques'
import { ChequesView } from '@/components/tesoreria/cheques-view'

export default async function ChequesPage() {
  const since = new Date()
  since.setDate(since.getDate() - 180)
  const [accounts, categories, cheques, recent] = await Promise.all([
    getAccounts(),
    getCategories(),
    getCheques(),
    getTransactions({ from: since.toISOString().slice(0, 10) }),
  ])

  // Débitos de cheques que llegaron del banco y no tienen cheque registrado.
  const linked = new Set(cheques.map((c) => c.transactionId).filter(Boolean))
  const unregistered = recent.filter(
    (t) => isChequeDebit(t.descriptionNorm, t.amount) && !linked.has(t.id)
  )

  const today = new Date().toISOString().slice(0, 10)
  return (
    <ChequesView
      accounts={accounts}
      categories={categories}
      cheques={cheques}
      unregistered={unregistered}
      outlook={chequeOutlook(cheques, today)}
      today={today}
    />
  )
}
