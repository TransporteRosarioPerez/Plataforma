import type {
  TreasuryAccount,
  TreasuryCheque,
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
