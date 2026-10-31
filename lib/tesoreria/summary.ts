import type {
  TreasuryAccount,
  TreasuryCategory,
  TreasuryScope,
  TreasuryTransaction,
} from './types'

export type ScopeFilter = 'todo' | TreasuryScope

export type CategoryTotal = {
  categoryId: string | null
  name: string
  kind: 'income' | 'expense' | 'unclassified'
  total: number
  count: number
}

export type MonthTotal = { month: string; income: number; expense: number; net: number }

export type AccountBalance = {
  accountId: string
  name: string
  kind: TreasuryAccount['kind']
  systemBalance: number
  lastBankBalance: number | null
  lastBankBalanceDate: string | null
  pendingCount: number
}

export type TreasurySummary = {
  income: number
  expense: number
  net: number
  personalExpense: number
  personalShareOfIncome: number | null
  pendingCount: number
  byCategory: CategoryTotal[]
  byMonth: MonthTotal[]
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

function matchesScope(tx: TreasuryTransaction, scope: ScopeFilter): boolean {
  if (scope === 'todo') return true
  return tx.scope === scope
}

/**
 * Totales del período. Los movimientos internos no suman.
 * Los no clasificados se muestran aparte como "Sin clasificar" (sólo en filtro "todo").
 */
export function summarize(
  txs: TreasuryTransaction[],
  categories: TreasuryCategory[],
  scope: ScopeFilter
): TreasurySummary {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const byCat = new Map<string, CategoryTotal>()
  const byMonth = new Map<string, MonthTotal>()
  let income = 0
  let expense = 0
  let personalExpense = 0
  let pendingCount = 0

  for (const tx of txs) {
    if (tx.deletedAt) continue
    if (tx.classification === 'pending') pendingCount++
    if (tx.isInternal) continue
    if (tx.scope === 'personal' && tx.amount < 0) personalExpense += -tx.amount
    if (!matchesScope(tx, scope)) continue

    if (tx.amount >= 0) income += tx.amount
    else expense += -tx.amount

    const m = monthKey(tx.txDate)
    const mt = byMonth.get(m) ?? { month: m, income: 0, expense: 0, net: 0 }
    if (tx.amount >= 0) mt.income += tx.amount
    else mt.expense += -tx.amount
    mt.net = mt.income - mt.expense
    byMonth.set(m, mt)

    const cat = tx.categoryId ? catMap.get(tx.categoryId) : undefined
    const key = cat ? cat.id : tx.amount >= 0 ? '__unclassified_in' : '__unclassified_out'
    const entry =
      byCat.get(key) ??
      ({
        categoryId: cat?.id ?? null,
        name: cat?.name ?? (tx.amount >= 0 ? 'Ingresos sin clasificar' : 'Egresos sin clasificar'),
        kind: cat ? (cat.kind === 'income' ? 'income' : 'expense') : 'unclassified',
        total: 0,
        count: 0,
      } satisfies CategoryTotal)
    entry.total += tx.amount
    entry.count += 1
    byCat.set(key, entry)
  }

  return {
    income,
    expense,
    net: income - expense,
    personalExpense,
    personalShareOfIncome: income > 0 ? personalExpense / income : null,
    pendingCount,
    byCategory: [...byCat.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
  }
}

/**
 * Saldo por cuenta: saldo inicial + movimientos desde la fecha de apertura.
 * Para bancos se muestra también el último saldo informado en el extracto,
 * así se ve enseguida si falta cargar algo.
 */
export function accountBalances(
  accounts: TreasuryAccount[],
  txs: TreasuryTransaction[]
): AccountBalance[] {
  return accounts
    .filter((a) => a.isActive)
    .map((account) => {
      const own = txs.filter(
        (t) =>
          !t.deletedAt &&
          t.accountId === account.id &&
          (!account.openingDate || t.txDate >= account.openingDate)
      )
      const systemBalance = account.openingBalance + own.reduce((acc, t) => acc + t.amount, 0)
      const withBalance = own
        .filter((t) => t.bankBalance !== null)
        .sort(
          (a, b) =>
            a.txDate.localeCompare(b.txDate) || (a.statementOrder ?? 0) - (b.statementOrder ?? 0)
        )
      const last = withBalance[withBalance.length - 1]
      return {
        accountId: account.id,
        name: account.name,
        kind: account.kind,
        systemBalance,
        lastBankBalance: last?.bankBalance ?? null,
        lastBankBalanceDate: last?.txDate ?? null,
        pendingCount: own.filter((t) => t.classification === 'pending').length,
      }
    })
}
