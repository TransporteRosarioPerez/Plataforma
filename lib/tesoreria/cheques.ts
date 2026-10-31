import type {
  ClassificationResult,
  TreasuryCategory,
  TreasuryCheque,
  TreasuryChequeStatus,
} from './types'
import { normalizeDescription } from './text'

/**
 * Débitos de cheques propios tal como los informa el banco.
 * Macro: "CHEQUE P/CAMARA" (por cámara compensadora) y "CHEQUE CANJE INTERNO"
 * (cobrado en el mismo banco). También contemplamos ECHEQ y la forma genérica de Nación.
 */
const CHEQUE_DEBIT = /\bCHEQUE (P\/CAMARA|CANJE INTERNO|PAGADO|DEBITADO)\b|\bE-?CHEQ\b|\bDEB(ITO)?\.? CHEQUE\b/

/** Multas por cheque rechazado: traen el número de cheque como referencia. */
const CHEQUE_REJECTION = /RECHAZO CH|CH(EQUE)? RECHAZADO/

export function isChequeDebit(descriptionNorm: string, amount: number): boolean {
  return amount < 0 && CHEQUE_DEBIT.test(normalizeDescription(descriptionNorm))
}

export function isChequeRejection(descriptionNorm: string): boolean {
  const d = normalizeDescription(descriptionNorm)
  return CHEQUE_REJECTION.test(d) && !/DEVOLUC/.test(d)
}

/** Normaliza el número de cheque para comparar ("00069614500" = "69614500"). */
export function normalizeChequeNumber(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '').replace(/^0+/, '')
}

export type ChequeMatchInput = {
  accountId: string
  reference: string | null
  descriptionNorm: string
  amount: number
}

export type ChequeMatch =
  | { kind: 'match'; cheque: TreasuryCheque }
  | { kind: 'amount_mismatch'; cheque: TreasuryCheque }
  | { kind: 'none' }

/** Busca en el registro el cheque de un débito: misma cuenta y mismo número. */
export function matchCheque(tx: ChequeMatchInput, cheques: TreasuryCheque[]): ChequeMatch {
  if (!isChequeDebit(tx.descriptionNorm, tx.amount)) return { kind: 'none' }
  const number = normalizeChequeNumber(tx.reference)
  if (!number) return { kind: 'none' }
  const cheque = cheques.find(
    (c) => c.accountId === tx.accountId && normalizeChequeNumber(c.chequeNumber) === number && c.status !== 'anulado'
  )
  if (!cheque) return { kind: 'none' }
  if (Math.abs(cheque.amount + tx.amount) > 0.01) return { kind: 'amount_mismatch', cheque }
  return { kind: 'match', cheque }
}

/** Cheque al que corresponde una multa por rechazo (misma cuenta y número). */
export function matchRejectedCheque(tx: ChequeMatchInput, cheques: TreasuryCheque[]): TreasuryCheque | null {
  if (!isChequeRejection(tx.descriptionNorm)) return null
  const number = normalizeChequeNumber(tx.reference)
  if (!number) return null
  return cheques.find((c) => c.accountId === tx.accountId && normalizeChequeNumber(c.chequeNumber) === number) ?? null
}

/** Clasificación de un débito a partir del cheque registrado. */
export function classifyFromCheque(
  cheque: TreasuryCheque,
  categories: TreasuryCategory[]
): ClassificationResult {
  const category = cheque.categoryId ? categories.find((c) => c.id === cheque.categoryId) : undefined
  const isInternal = category?.kind === 'internal'
  const scope = isInternal ? null : cheque.scope ?? category?.defaultScope ?? null
  const complete = isInternal || (!!category && !!scope)
  return {
    categoryId: category?.id ?? null,
    scope,
    ruleId: null,
    isInternal,
    transferAccountId: null,
    classification: complete ? 'auto' : 'pending',
    matchedBy: 'cheque',
  }
}

/**
 * Estado que corresponde según lo que pasó en el banco.
 * Un débito gana siempre (un cheque rechazado puede volver a presentarse y pagarse).
 * "anulado" lo decide el usuario y no se pisa.
 */
export function deriveChequeStatus(
  current: TreasuryChequeStatus,
  hasDebit: boolean,
  hasRejection: boolean
): TreasuryChequeStatus {
  if (hasDebit) return 'debitado'
  if (current === 'anulado') return 'anulado'
  if (hasRejection) return 'rechazado'
  return 'emitido'
}

export type ChequeOutlook = {
  pendingCount: number
  pendingAmount: number
  next7Amount: number
  overdueCount: number
}

/**
 * Cheques emitidos que todavía no se debitaron: plata que va a salir.
 * "Vencidos" = fecha de pago pasada y todavía sin debitar (revisar si se cobraron).
 */
export function chequeOutlook(cheques: TreasuryCheque[], today: string): ChequeOutlook {
  const pending = cheques.filter((c) => c.status === 'emitido')
  const in7 = new Date(`${today}T00:00:00Z`)
  in7.setUTCDate(in7.getUTCDate() + 7)
  const limit = in7.toISOString().slice(0, 10)
  return {
    pendingCount: pending.length,
    pendingAmount: pending.reduce((acc, c) => acc + c.amount, 0),
    next7Amount: pending
      .filter((c) => !c.paymentDate || c.paymentDate <= limit)
      .reduce((acc, c) => acc + c.amount, 0),
    overdueCount: pending.filter((c) => c.paymentDate && c.paymentDate < today).length,
  }
}
