import {
  getAccounts,
  getCategories,
  getCheques,
  getReceivedCheques,
  getTransactions,
} from '@/lib/tesoreria/server/data'
import { chequeOutlook, isChequeDebit } from '@/lib/tesoreria/cheques'
import { ChequesView } from '@/components/tesoreria/cheques-view'
import { ReceivedChequesView } from '@/components/tesoreria/received-cheques-view'
import { ChequesTabs } from '@/components/tesoreria/cheques-tabs'

type SearchParams = Promise<{ tab?: string }>

export default async function ChequesPage({ searchParams }: { searchParams: SearchParams }) {
  const { tab } = await searchParams
  const since = new Date()
  since.setDate(since.getDate() - 180)
  const [accounts, categories, cheques, received, recent] = await Promise.all([
    getAccounts(),
    getCategories(),
    getCheques(),
    getReceivedCheques(),
    getTransactions({ from: since.toISOString().slice(0, 10) }),
  ])

  // Débitos de cheques que llegaron del banco y no tienen cheque registrado.
  const linked = new Set(cheques.map((c) => c.transactionId).filter(Boolean))
  const unregistered = recent.filter((t) => isChequeDebit(t.descriptionNorm, t.amount) && !linked.has(t.id))

  // Créditos de bancos que pueden liquidar cheques recibidos (depósitos o descuentos).
  const bankIds = new Set(accounts.filter((a) => a.kind !== 'cash').map((a) => a.id))
  const used = new Set(received.map((c) => c.settlementTransactionId).filter(Boolean))
  const credits = recent
    .filter((t) => t.amount > 0 && !t.isInternal && bankIds.has(t.accountId) && !used.has(t.id))
    // Primero los que parecen descuentos o depósitos de cheques.
    .sort((a, b) => {
      const score = (t: typeof a) => (/CCERR|OVER CASH|DEPOSITO|CHEQUE|ECHEQ/.test(t.descriptionNorm) ? 0 : 1)
      return score(a) - score(b) || b.txDate.localeCompare(a.txDate)
    })
    .slice(0, 100)
  const settlementIds = new Set(received.map((c) => c.settlementTransactionId).filter(Boolean))
  const settlements = recent.filter((t) => settlementIds.has(t.id))

  const today = new Date().toISOString().slice(0, 10)
  return (
    <ChequesTabs
      initial={tab === 'recibidos' ? 'recibidos' : 'emitidos'}
      emitted={
        <ChequesView
          accounts={accounts}
          categories={categories}
          cheques={cheques}
          unregistered={unregistered}
          outlook={chequeOutlook(cheques, today)}
          today={today}
        />
      }
      received={<ReceivedChequesView accounts={accounts} cheques={received} credits={credits} settlements={settlements} />}
    />
  )
}
