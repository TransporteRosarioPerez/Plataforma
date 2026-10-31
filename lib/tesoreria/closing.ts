import type { StatementRow, TreasuryAccount, TreasuryTransaction } from './types'

export type MonthClose = {
  id: string
  accountId: string
  /** yyyy-mm */
  month: string
  systemBalance: number
  bankBalance: number | null
  difference: number | null
  pendingCount: number
  notes: string | null
  status: 'closed' | 'reopened'
  closedAt: string
  reopenedAt: string | null
  reopenReason: string | null
}

export type CashCount = {
  id: string
  accountId: string
  countDate: string
  countedAmount: number
  systemAmount: number
  difference: number
  adjustmentTransactionId: string | null
  notes: string | null
}

export function monthStart(month: string): string {
  return `${month}-01`
}

export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

export function previousMonths(fromMonth: string, count: number): string[] {
  const [y, m] = fromMonth.split('-').map(Number)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

function ownTxs(account: TreasuryAccount, txs: TreasuryTransaction[]) {
  return txs.filter(
    (t) => !t.deletedAt && t.accountId === account.id && (!account.openingDate || t.txDate >= account.openingDate)
  )
}

/** Saldo según el sistema al final del día `date`. */
export function systemBalanceAt(account: TreasuryAccount, txs: TreasuryTransaction[], date: string): number {
  return Math.round(
    (account.openingBalance + ownTxs(account, txs).filter((t) => t.txDate <= date).reduce((a, t) => a + t.amount, 0)) * 100
  ) / 100
}

/** Último saldo informado por el banco hasta `date` (incluido). */
export function bankBalanceAt(
  account: TreasuryAccount,
  txs: TreasuryTransaction[],
  date: string
): { balance: number; date: string } | null {
  const withBalance = ownTxs(account, txs)
    .filter((t) => t.bankBalance !== null && t.txDate <= date)
    .sort((a, b) => a.txDate.localeCompare(b.txDate) || (a.statementOrder ?? 0) - (b.statementOrder ?? 0))
  const last = withBalance[withBalance.length - 1]
  return last ? { balance: last.bankBalance as number, date: last.txDate } : null
}

export type CloseRow = {
  accountId: string
  month: string
  systemBalance: number
  /** Banco/billetera: saldo del extracto. Efectivo: último arqueo del mes. */
  referenceBalance: number | null
  referenceDate: string | null
  difference: number | null
  pendingCount: number
  movementCount: number
  close: MonthClose | null
}

export function buildCloseRows(
  accounts: TreasuryAccount[],
  txs: TreasuryTransaction[],
  closes: MonthClose[],
  cashCounts: CashCount[],
  months: string[]
): CloseRow[] {
  const rows: CloseRow[] = []
  for (const account of accounts.filter((a) => a.isActive)) {
    for (const month of months) {
      const end = monthEnd(month)
      const inMonth = txs.filter((t) => !t.deletedAt && t.accountId === account.id && t.txDate.startsWith(month))
      const systemBalance = systemBalanceAt(account, txs, end)
      let reference: { balance: number; date: string } | null = null
      if (account.kind === 'cash') {
        const count = cashCounts
          .filter((c) => c.accountId === account.id && c.countDate.startsWith(month))
          .sort((a, b) => b.countDate.localeCompare(a.countDate))[0]
        // El arqueo compara contra el saldo de ESE día, no del fin de mes.
        reference = count ? { balance: count.countedAmount, date: count.countDate } : null
      } else {
        const bank = bankBalanceAt(account, txs, end)
        reference = bank && bank.date.startsWith(month) ? bank : null
      }
      const compareTo = reference
        ? account.kind === 'cash'
          ? systemBalanceAt(account, txs, reference.date)
          : systemBalance
        : null
      rows.push({
        accountId: account.id,
        month,
        systemBalance,
        referenceBalance: reference?.balance ?? null,
        referenceDate: reference?.date ?? null,
        difference: reference && compareTo !== null ? Math.round((compareTo - reference.balance) * 100) / 100 : null,
        pendingCount: inMonth.filter((t) => t.classification === 'pending').length,
        movementCount: inMonth.length,
        close: closes.find((c) => c.accountId === account.id && c.month === month && c.status === 'closed') ?? null,
      })
    }
  }
  return rows
}

/** Meses cerrados de una cuenta que quedarían afectados por estas fechas. */
export function closedMonthsTouched(accountId: string, dates: string[], closes: MonthClose[]): string[] {
  const closed = new Set(closes.filter((c) => c.accountId === accountId && c.status === 'closed').map((c) => c.month))
  return [...new Set(dates.map((d) => d.slice(0, 7)).filter((m) => closed.has(m)))].sort()
}

export type ImportGap = {
  /** Último movimiento ya cargado de la cuenta */
  lastLoadedDate: string
  lastLoadedBalance: number
  /** Primer movimiento del archivo */
  fileStartDate: string
  fileOpeningBalance: number
  /** Plata que se movió entre un archivo y otro y no está en ninguno */
  difference: number
}

/**
 * Detecta un hueco entre lo ya cargado y el archivo nuevo: el saldo con el que arranca el
 * archivo (saldo después del primer movimiento − su monto) tiene que ser igual al último saldo
 * guardado. Si el archivo se superpone con lo cargado (hay duplicados), la continuidad ya está
 * probada por la superposición.
 */
export function detectImportGap(
  lastLoaded: { txDate: string; bankBalance: number } | null,
  rows: Pick<StatementRow, 'txDate' | 'amount' | 'bankBalance' | 'statementOrder'>[],
  duplicateCount: number
): ImportGap | null {
  if (!lastLoaded || duplicateCount > 0 || rows.length === 0) return null
  const first = [...rows].sort((a, b) => a.statementOrder - b.statementOrder)[0]
  if (first.bankBalance === null || first.txDate < lastLoaded.txDate) return null
  const fileOpeningBalance = Math.round((first.bankBalance - first.amount) * 100) / 100
  const difference = Math.round((fileOpeningBalance - lastLoaded.bankBalance) * 100) / 100
  if (Math.abs(difference) <= 0.01) return null
  return {
    lastLoadedDate: lastLoaded.txDate,
    lastLoadedBalance: lastLoaded.bankBalance,
    fileStartDate: first.txDate,
    fileOpeningBalance,
    difference,
  }
}
