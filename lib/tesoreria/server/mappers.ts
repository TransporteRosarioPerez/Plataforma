import type { CashCount, MonthClose } from '../closing'
import type { ForecastItem } from '../forecast'
import type {
  TreasuryAccount,
  TreasuryCheque,
  TreasuryReceivedCheque,
  TreasuryCategory,
  TreasuryCounterparty,
  TreasuryImportBatch,
  TreasuryRule,
  TreasuryTransaction,
} from '../types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

const num = (v: unknown): number => Number(v ?? 0)
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

export const ACCOUNT_COLUMNS =
  'id, code, name, kind, provider, currency, opening_balance, opening_date, is_active, sort_order'
export function mapAccount(r: Row): TreasuryAccount {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    kind: r.kind,
    provider: r.provider ?? null,
    currency: r.currency,
    openingBalance: num(r.opening_balance),
    openingDate: r.opening_date ?? null,
    isActive: r.is_active,
    sortOrder: r.sort_order,
  }
}

export const CATEGORY_COLUMNS = 'id, name, kind, default_scope, is_active, sort_order'
export function mapCategory(r: Row): TreasuryCategory {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    defaultScope: r.default_scope ?? null,
    isActive: r.is_active,
    sortOrder: r.sort_order,
  }
}

export const RULE_COLUMNS =
  'id, name, match_type, pattern, direction, account_id, category_id, scope, transfer_account_id, priority, is_active'
export function mapRule(r: Row): TreasuryRule {
  return {
    id: r.id,
    name: r.name,
    matchType: r.match_type,
    pattern: r.pattern,
    direction: r.direction,
    accountId: r.account_id ?? null,
    categoryId: r.category_id ?? null,
    scope: r.scope ?? null,
    transferAccountId: r.transfer_account_id ?? null,
    priority: r.priority,
    isActive: r.is_active,
  }
}

export const COUNTERPARTY_COLUMNS = 'id, cuit, name, category_id, scope, notes'
export function mapCounterparty(r: Row): TreasuryCounterparty {
  return {
    id: r.id,
    cuit: r.cuit,
    name: r.name,
    categoryId: r.category_id ?? null,
    scope: r.scope ?? null,
    notes: r.notes ?? null,
  }
}

export const TRANSACTION_COLUMNS =
  'id, account_id, import_batch_id, source, tx_date, reference, description_raw, description_norm, amount, bank_balance, statement_order, counterparty_cuit, category_id, scope, is_internal, transfer_pair_id, classification, rule_id, notes, deleted_at'
export function mapTransaction(r: Row): TreasuryTransaction {
  return {
    id: r.id,
    accountId: r.account_id,
    importBatchId: r.import_batch_id ?? null,
    source: r.source,
    txDate: r.tx_date,
    reference: r.reference ?? null,
    descriptionRaw: r.description_raw,
    descriptionNorm: r.description_norm,
    amount: num(r.amount),
    bankBalance: numOrNull(r.bank_balance),
    statementOrder: r.statement_order ?? null,
    counterpartyCuit: r.counterparty_cuit ?? null,
    categoryId: r.category_id ?? null,
    scope: r.scope ?? null,
    isInternal: r.is_internal,
    transferPairId: r.transfer_pair_id ?? null,
    classification: r.classification,
    ruleId: r.rule_id ?? null,
    notes: r.notes ?? null,
    deletedAt: r.deleted_at ?? null,
  }
}

export const BATCH_COLUMNS =
  'id, account_id, file_name, date_from, date_to, row_count, auto_count, pending_count, skipped_duplicates, balance_breaks, created_at, deleted_at'
export function mapBatch(r: Row): TreasuryImportBatch {
  return {
    id: r.id,
    accountId: r.account_id,
    fileName: r.file_name,
    dateFrom: r.date_from ?? null,
    dateTo: r.date_to ?? null,
    rowCount: r.row_count,
    autoCount: r.auto_count,
    pendingCount: r.pending_count,
    skippedDuplicates: r.skipped_duplicates,
    balanceBreaks: r.balance_breaks,
    createdAt: r.created_at,
    deletedAt: r.deleted_at ?? null,
  }
}


export const CHEQUE_COLUMNS =
  'id, account_id, cheque_number, amount, issue_date, payment_date, payee_name, payee_cuit, category_id, scope, notes, status, transaction_id'
export function mapCheque(r: Row): TreasuryCheque {
  return {
    id: r.id,
    accountId: r.account_id,
    chequeNumber: r.cheque_number,
    amount: num(r.amount),
    issueDate: r.issue_date ?? null,
    paymentDate: r.payment_date ?? null,
    payeeName: r.payee_name,
    payeeCuit: r.payee_cuit ?? null,
    categoryId: r.category_id ?? null,
    scope: r.scope ?? null,
    notes: r.notes ?? null,
    status: r.status,
    transactionId: r.transaction_id ?? null,
  }
}

export const MONTH_CLOSE_COLUMNS =
  'id, account_id, month, system_balance, bank_balance, difference, pending_count, notes, status, closed_at, reopened_at, reopen_reason'
export function mapMonthClose(r: Row): MonthClose {
  return {
    id: r.id,
    accountId: r.account_id,
    month: String(r.month).slice(0, 7),
    systemBalance: num(r.system_balance),
    bankBalance: numOrNull(r.bank_balance),
    difference: numOrNull(r.difference),
    pendingCount: r.pending_count,
    notes: r.notes ?? null,
    status: r.status,
    closedAt: r.closed_at,
    reopenedAt: r.reopened_at ?? null,
    reopenReason: r.reopen_reason ?? null,
  }
}

export const CASH_COUNT_COLUMNS =
  'id, account_id, count_date, counted_amount, system_amount, difference, adjustment_transaction_id, notes'
export function mapCashCount(r: Row): CashCount {
  return {
    id: r.id,
    accountId: r.account_id,
    countDate: r.count_date,
    countedAmount: num(r.counted_amount),
    systemAmount: num(r.system_amount),
    difference: num(r.difference),
    adjustmentTransactionId: r.adjustment_transaction_id ?? null,
    notes: r.notes ?? null,
  }
}

export const FORECAST_COLUMNS =
  'id, name, amount, frequency, start_date, end_date, day_of_month, account_id, category_id, is_active, notes'
export function mapForecastItem(r: Row): ForecastItem {
  return {
    id: r.id,
    name: r.name,
    amount: num(r.amount),
    frequency: r.frequency,
    startDate: r.start_date,
    endDate: r.end_date ?? null,
    dayOfMonth: r.day_of_month ?? null,
    accountId: r.account_id ?? null,
    categoryId: r.category_id ?? null,
    isActive: r.is_active,
    notes: r.notes ?? null,
  }
}

export const RECEIVED_CHEQUE_COLUMNS =
  'id, cheque_number, bank_name, issuer_name, issuer_cuit, amount, received_date, payment_date, status, settlement_transaction_id, endorsed_to, notes'
export function mapReceivedCheque(r: Row): TreasuryReceivedCheque {
  return {
    id: r.id,
    chequeNumber: r.cheque_number,
    bankName: r.bank_name ?? null,
    issuerName: r.issuer_name,
    issuerCuit: r.issuer_cuit ?? null,
    amount: num(r.amount),
    receivedDate: r.received_date ?? null,
    paymentDate: r.payment_date ?? null,
    status: r.status,
    settlementTransactionId: r.settlement_transaction_id ?? null,
    endorsedTo: r.endorsed_to ?? null,
    notes: r.notes ?? null,
  }
}
