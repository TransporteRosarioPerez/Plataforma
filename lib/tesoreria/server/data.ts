import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/session'
import {
  ACCOUNT_COLUMNS,
  BATCH_COLUMNS,
  CATEGORY_COLUMNS,
  COUNTERPARTY_COLUMNS,
  RULE_COLUMNS,
  TRANSACTION_COLUMNS,
  mapAccount,
  mapBatch,
  mapCategory,
  mapCounterparty,
  mapRule,
  mapTransaction,
} from './mappers'
import type {
  TreasuryAccount,
  TreasuryCategory,
  TreasuryClassification,
  TreasuryCounterparty,
  TreasuryImportBatch,
  TreasuryRule,
  TreasuryScope,
  TreasuryTransaction,
} from '../types'

const PAGE = 1000

/** Supabase devuelve como máximo 1000 filas por consulta: paginamos. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>, map: (r: any) => T): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows.map(map))
    if (rows.length < PAGE) break
  }
  return out
}

export async function getAccounts(includeInactive = true): Promise<TreasuryAccount[]> {
  await requireSuperadmin()
  const supabase = await createClient()
  let q = supabase.from('treasury_accounts').select(ACCOUNT_COLUMNS).is('deleted_at', null)
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q.order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapAccount)
}

export async function getCategories(): Promise<TreasuryCategory[]> {
  await requireSuperadmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('treasury_categories')
    .select(CATEGORY_COLUMNS)
    .is('deleted_at', null)
    .order('sort_order')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapCategory)
}

export async function getRules(): Promise<TreasuryRule[]> {
  await requireSuperadmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('treasury_rules')
    .select(RULE_COLUMNS)
    .is('deleted_at', null)
    .order('priority')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRule)
}

export async function getCounterparties(): Promise<TreasuryCounterparty[]> {
  await requireSuperadmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('treasury_counterparties')
    .select(COUNTERPARTY_COLUMNS)
    .is('deleted_at', null)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapCounterparty)
}

export type TransactionFilters = {
  from?: string
  to?: string
  accountId?: string
  categoryId?: string | 'none'
  scope?: TreasuryScope | 'none'
  classification?: TreasuryClassification
  search?: string
  includeInternal?: boolean
}

export async function getTransactions(filters: TransactionFilters = {}): Promise<TreasuryTransaction[]> {
  await requireSuperadmin()
  const supabase = await createClient()
  return fetchAll((from, to) => {
    let q = supabase.from('treasury_transactions').select(TRANSACTION_COLUMNS).is('deleted_at', null)
    if (filters.from) q = q.gte('tx_date', filters.from)
    if (filters.to) q = q.lte('tx_date', filters.to)
    if (filters.accountId) q = q.eq('account_id', filters.accountId)
    if (filters.categoryId === 'none') q = q.is('category_id', null)
    else if (filters.categoryId) q = q.eq('category_id', filters.categoryId)
    if (filters.scope === 'none') q = q.is('scope', null)
    else if (filters.scope) q = q.eq('scope', filters.scope)
    if (filters.classification) q = q.eq('classification', filters.classification)
    if (filters.includeInternal === false) q = q.eq('is_internal', false)
    if (filters.search) q = q.ilike('description_norm', `%${filters.search.toUpperCase()}%`)
    return q
      .order('tx_date', { ascending: false })
      .order('statement_order', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .range(from, to)
  }, mapTransaction)
}

export async function getPendingTransactions(): Promise<TreasuryTransaction[]> {
  return getTransactions({ classification: 'pending' })
}

export async function getExistingDedupKeys(accountId: string, keys: string[]): Promise<Set<string>> {
  await requireSuperadmin()
  const supabase = await createClient()
  const found = new Set<string>()
  for (let i = 0; i < keys.length; i += 200) {
    const chunk = keys.slice(i, i + 200)
    const { data, error } = await supabase
      .from('treasury_transactions')
      .select('dedup_key')
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .in('dedup_key', chunk)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) if (r.dedup_key) found.add(r.dedup_key as string)
  }
  return found
}

export async function getImportBatches(): Promise<TreasuryImportBatch[]> {
  await requireSuperadmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('treasury_import_batches')
    .select(BATCH_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapBatch)
}

