import type {
  ClassificationResult,
  StatementRow,
  TreasuryCategory,
  TreasuryCounterparty,
  TreasuryRule,
  TreasuryScope,
} from './types'
import { normalizeDescription, roundMoney } from './text'

// ---------------------------------------------------------------------------
// Deduplicación
// ---------------------------------------------------------------------------

/**
 * Clave estable por movimiento dentro de una cuenta.
 * Incluye un índice de ocurrencia para no perder movimientos idénticos y legítimos
 * del mismo día (ej. dos cargas iguales en el mismo comercio).
 */
export function buildDedupKeys(rows: Pick<StatementRow, 'txDate' | 'reference' | 'amount' | 'description'>[]): string[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const base = [
      row.txDate,
      row.reference ?? '',
      roundMoney(row.amount).toFixed(2),
      normalizeDescription(row.description),
    ].join('|')
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return `${base}#${n}`
  })
}

// ---------------------------------------------------------------------------
// Control de saldos
// ---------------------------------------------------------------------------

/**
 * Cuenta cuántas filas no encadenan con el saldo informado por el banco.
 * Espera bankBalance normalizado a "después del movimiento" (lo hace el parser):
 *   saldo(fila) = saldo(fila anterior) + monto(fila)
 * Un corte suele indicar un movimiento faltante o un ajuste del banco fuera de secuencia.
 */
export function countBalanceBreaks(
  rows: Pick<StatementRow, 'amount' | 'bankBalance' | 'statementOrder'>[]
): number {
  const ordered = [...rows].sort((a, b) => a.statementOrder - b.statementOrder)
  let breaks = 0
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]
    const cur = ordered[i]
    if (prev.bankBalance === null || cur.bankBalance === null) continue
    if (Math.abs(prev.bankBalance + cur.amount - cur.bankBalance) > 0.01) breaks++
  }
  return breaks
}

// ---------------------------------------------------------------------------
// Clasificación
// ---------------------------------------------------------------------------

export type ClassifyInput = {
  descriptionNorm: string
  amount: number
  accountId: string
  counterpartyCuit: string | null
}

const regexCache = new Map<string, RegExp | null>()

function compileRegex(pattern: string): RegExp | null {
  if (!regexCache.has(pattern)) {
    try {
      regexCache.set(pattern, new RegExp(pattern, 'i'))
    } catch {
      regexCache.set(pattern, null)
    }
  }
  return regexCache.get(pattern) ?? null
}

export function isValidRulePattern(matchType: TreasuryRule['matchType'], pattern: string): boolean {
  if (!pattern.trim()) return false
  if (matchType === 'regex') return compileRegex(pattern) !== null
  if (matchType === 'cuit') return /^\d{11}$/.test(pattern.trim())
  return true
}

export function ruleMatches(rule: TreasuryRule, tx: ClassifyInput): boolean {
  if (!rule.isActive) return false
  if (rule.accountId && rule.accountId !== tx.accountId) return false
  if (rule.direction === 'in' && tx.amount <= 0) return false
  if (rule.direction === 'out' && tx.amount >= 0) return false

  switch (rule.matchType) {
    case 'contains':
      return tx.descriptionNorm.includes(normalizeDescription(rule.pattern))
    case 'regex': {
      const re = compileRegex(rule.pattern)
      return re ? re.test(tx.descriptionNorm) : false
    }
    case 'cuit':
      return !!tx.counterpartyCuit && tx.counterpartyCuit === rule.pattern.trim()
  }
}

function resolve(
  categoryId: string | null,
  explicitScope: TreasuryScope | null,
  categories: Map<string, TreasuryCategory>,
  transferAccountId: string | null
): Pick<ClassificationResult, 'categoryId' | 'scope' | 'isInternal' | 'classification' | 'transferAccountId'> {
  const category = categoryId ? categories.get(categoryId) : undefined
  const isInternal = category?.kind === 'internal' || !!transferAccountId
  const scope = isInternal ? null : explicitScope ?? category?.defaultScope ?? null
  const complete = isInternal || (!!categoryId && !!scope)
  return {
    categoryId: categoryId ?? null,
    scope,
    isInternal,
    transferAccountId,
    classification: complete ? 'auto' : 'pending',
  }
}

/**
 * Clasifica un movimiento. Orden: contraparte por CUIT (más específica)
 * y después reglas por prioridad ascendente. La primera que matchea gana.
 */
export function classify(
  tx: ClassifyInput,
  rules: TreasuryRule[],
  counterparties: TreasuryCounterparty[],
  categories: TreasuryCategory[]
): ClassificationResult {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  if (tx.counterpartyCuit) {
    const cp = counterparties.find((c) => c.cuit === tx.counterpartyCuit)
    if (cp && (cp.categoryId || cp.scope)) {
      return {
        ...resolve(cp.categoryId, cp.scope, categoryMap, null),
        ruleId: null,
        matchedBy: 'counterparty',
      }
    }
  }

  const ordered = [...rules].sort((a, b) => a.priority - b.priority)
  for (const rule of ordered) {
    if (!ruleMatches(rule, tx)) continue
    return {
      ...resolve(rule.categoryId, rule.scope, categoryMap, rule.transferAccountId),
      ruleId: rule.id,
      matchedBy: 'rule',
    }
  }

  return {
    categoryId: null,
    scope: null,
    ruleId: null,
    isInternal: false,
    transferAccountId: null,
    classification: 'pending',
    matchedBy: null,
  }
}

/** Sugiere un patrón "contiene" a partir de una descripción (para crear reglas desde pendientes). */
export function suggestPattern(descriptionNorm: string): string {
  const cleaned = descriptionNorm
    .replace(/\d{6,}/g, ' ')
    .replace(/SUC\.?:\s*\d+/g, ' ')
    .replace(/[-:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.split(' ').slice(0, 4).join(' ')
}

// ---------------------------------------------------------------------------
// Transferencias internas
// ---------------------------------------------------------------------------

export type InternalCandidateInput = {
  id: string
  accountId: string
  txDate: string
  amount: number
  isInternal: boolean
}

export type InternalPair = { outId: string; inId: string; amount: number; daysApart: number }

function dayDiff(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000
}

/**
 * Busca pares egreso/ingreso del mismo monto entre cuentas distintas
 * dentro de ±maxDays. Cada movimiento participa en un solo par.
 */
export function findInternalPairs(txs: InternalCandidateInput[], maxDays = 2): InternalPair[] {
  const outs = txs.filter((t) => !t.isInternal && t.amount < 0)
  const ins = txs.filter((t) => !t.isInternal && t.amount > 0)
  const used = new Set<string>()
  const pairs: InternalPair[] = []

  for (const out of outs) {
    let best: { tx: InternalCandidateInput; days: number } | null = null
    for (const inc of ins) {
      if (used.has(inc.id) || inc.accountId === out.accountId) continue
      if (Math.abs(inc.amount + out.amount) > 0.005) continue
      const days = dayDiff(inc.txDate, out.txDate)
      if (days > maxDays) continue
      if (!best || days < best.days) best = { tx: inc, days }
    }
    if (best) {
      used.add(best.tx.id)
      pairs.push({ outId: out.id, inId: best.tx.id, amount: -out.amount, daysApart: best.days })
    }
  }
  return pairs
}

// ---------------------------------------------------------------------------
// Estado de un movimiento editado a mano
// ---------------------------------------------------------------------------

export function manualClassification(
  categoryId: string | null,
  scope: TreasuryScope | null,
  category: TreasuryCategory | undefined
): { scope: TreasuryScope | null; isInternal: boolean; classification: 'manual' | 'pending' } {
  const isInternal = category?.kind === 'internal'
  const finalScope = isInternal ? null : scope ?? category?.defaultScope ?? null
  const complete = isInternal || (!!categoryId && !!finalScope)
  return { scope: finalScope, isInternal, classification: complete ? 'manual' : 'pending' }
}
