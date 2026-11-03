import type { TreasuryAccount, TreasuryCategory, TreasuryCheque, TreasuryTransaction } from './types'

/**
 * Las dos preguntas del Resumen, en palabras simples:
 *  1. ¿Cuánta plata hay?  → saldo de todas las cuentas al empezar y al terminar el mes.
 *  2. ¿Se ganó plata trabajando? → lo facturado en el mes menos lo que costó (aproximado).
 * Son números distintos: una deuda pagada o un cobro atrasado mueven la plata sin ser ganancia.
 */

/** Categorías de egreso que no son gasto: devolver un préstamo no es un costo del mes. */
const NOT_AN_EXPENSE = new Set(['Pago de préstamos'])

export type InvoiceForMonth = { issueDate: string; total: number; status: string }

export type AccountCashPosition = {
  accountId: string
  name: string
  start: number
  inflow: number
  outflow: number
  /** Transferencias entre cuentas propias (a otra cuenta cargada o a una que no está en Tesorería). */
  transfers: number
  end: number
}

export type CashPosition = {
  start: number
  inflow: number
  outflow: number
  /** Lo que pasó a/desde cuentas propias que no están en Tesorería (o diferencias de apertura). */
  otherAccounts: number
  end: number
  startDate: string
  endDate: string
  /** Cuentas que todavía no tenían saldo inicial cargado al empezar el mes. */
  skippedAccounts: string[]
  byAccount: AccountCashPosition[]
}

export type MonthlyProfit = {
  invoiced: number
  invoiceCount: number
  expenses: number
  profit: number
  /** Gastos sin clasificar que se cuentan igual (no se sabe todavía si son de la empresa). */
  unclassifiedCount: number
  unclassifiedAmount: number
  /** Cheques firmados en el mes que todavía no salieron del banco. */
  committedCheques: number
  committedChequeCount: number
  loanPayments: number
  personalExpenses: number
}

export function monthBounds(month: string, today: string): { first: string; last: string; isCurrent: boolean } {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const first = `${month}-01`
  const last = `${month}-${String(lastDay).padStart(2, '0')}`
  const isCurrent = today >= first && today <= last
  return { first, last: isCurrent ? today : last, isCurrent }
}

export function cashPosition(
  accounts: TreasuryAccount[],
  txs: TreasuryTransaction[],
  month: string,
  today: string
): CashPosition {
  const { first, last } = monthBounds(month, today)
  const active = accounts.filter((a) => a.isActive)
  const included = active.filter((a) => !a.openingDate || a.openingDate <= first)
  const rows = new Map(
    included.map((a) => [
      a.id,
      { accountId: a.id, name: a.name, start: a.openingBalance, inflow: 0, outflow: 0, transfers: 0, end: a.openingBalance, from: a.openingDate },
    ])
  )

  for (const t of txs) {
    const row = rows.get(t.accountId)
    if (t.deletedAt || !row) continue
    if (row.from && t.txDate < row.from) continue
    if (t.txDate < first) row.start += t.amount
    if (t.txDate <= last) row.end += t.amount
    if (t.txDate >= first && t.txDate <= last) {
      if (t.isInternal) row.transfers += t.amount
      else if (t.amount >= 0) row.inflow += t.amount
      else row.outflow += -t.amount
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100
  const byAccount: AccountCashPosition[] = [...rows.values()].map((r) => ({
    accountId: r.accountId,
    name: r.name,
    start: round(r.start),
    inflow: round(r.inflow),
    outflow: round(r.outflow),
    // Lo que no explican entradas y salidas (internas y movimientos fuera de la fecha de apertura).
    transfers: round(r.end - r.start - (r.inflow - r.outflow)),
    end: round(r.end),
  }))
  const sum = (k: 'start' | 'inflow' | 'outflow' | 'transfers' | 'end') => round(byAccount.reduce((acc, r) => acc + r[k], 0))

  return {
    start: sum('start'),
    inflow: sum('inflow'),
    outflow: sum('outflow'),
    otherAccounts: sum('transfers'),
    end: sum('end'),
    startDate: first,
    endDate: last,
    skippedAccounts: active.filter((a) => !rows.has(a.id)).map((a) => a.name),
    byAccount,
  }
}

export function monthlyProfit(
  txs: TreasuryTransaction[],
  categories: TreasuryCategory[],
  cheques: TreasuryCheque[],
  invoices: InvoiceForMonth[],
  month: string
): MonthlyProfit {
  const inMonth = (d: string | null) => !!d && d.slice(0, 7) === month
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const chequeByTx = new Map(cheques.filter((c) => c.transactionId).map((c) => [c.transactionId as string, c]))

  const valid = invoices.filter((i) => inMonth(i.issueDate) && i.status !== 'anulada')
  const invoiced = valid.reduce((acc, i) => acc + Number(i.total), 0)

  let expenses = 0
  let unclassifiedCount = 0
  let unclassifiedAmount = 0
  let loanPayments = 0
  let personalExpenses = 0

  for (const t of txs) {
    if (t.deletedAt || t.isInternal || t.amount >= 0) continue
    // Un cheque registrado cuenta en el mes en que se firmó, no en el que se debitó.
    const cheque = chequeByTx.get(t.id)
    const effectiveDate = cheque?.issueDate ?? t.txDate
    if (!inMonth(effectiveDate)) continue

    const amount = -t.amount
    if (t.scope === 'personal') {
      personalExpenses += amount
      continue
    }
    const name = t.categoryId ? catName.get(t.categoryId) : undefined
    if (name && NOT_AN_EXPENSE.has(name)) {
      loanPayments += amount
      continue
    }
    expenses += amount
    if (!t.categoryId || !t.scope) {
      unclassifiedCount++
      unclassifiedAmount += amount
    }
  }

  // Cheques firmados en el mes que el banco todavía no debitó: ya son un gasto comprometido.
  let committedCheques = 0
  let committedChequeCount = 0
  for (const c of cheques) {
    if (c.status !== 'emitido' || c.transactionId || !inMonth(c.issueDate)) continue
    if (c.scope === 'personal') {
      personalExpenses += c.amount
      continue
    }
    committedCheques += c.amount
    committedChequeCount++
  }
  expenses += committedCheques

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    invoiced: round(invoiced),
    invoiceCount: valid.length,
    expenses: round(expenses),
    profit: round(invoiced - expenses),
    unclassifiedCount,
    unclassifiedAmount: round(unclassifiedAmount),
    committedCheques: round(committedCheques),
    committedChequeCount,
    loanPayments: round(loanPayments),
    personalExpenses: round(personalExpenses),
  }
}
