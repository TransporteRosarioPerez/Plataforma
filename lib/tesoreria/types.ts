// Tipos del módulo Tesorería. Independiente del resto de la plataforma.

export type TreasuryProvider = 'macro' | 'nacion' | 'mercadopago'
export type TreasuryAccountKind = 'bank' | 'wallet' | 'cash'
export type TreasuryCategoryKind = 'income' | 'expense' | 'internal'
export type TreasuryScope = 'empresa' | 'personal'
export type TreasuryClassification = 'pending' | 'auto' | 'manual'
export type TreasuryRuleMatchType = 'contains' | 'regex' | 'cuit'
export type TreasuryRuleDirection = 'any' | 'in' | 'out'
export type TreasurySource = 'import' | 'manual' | 'transfer_mirror'

/** Celda tal como sale de SheetJS (sheet_to_json con header: 1, raw: true). */
export type SheetCell = string | number | boolean | null

/** Fila normalizada de un extracto, igual para todos los bancos. */
export type StatementRow = {
  /** Fecha ISO yyyy-mm-dd */
  txDate: string
  reference: string | null
  description: string
  /** Positivo = ingreso, negativo = egreso */
  amount: number
  /** Saldo DESPUÉS del movimiento (los parsers normalizan bancos que informan el saldo anterior). */
  bankBalance: number | null
  /** Posición cronológica dentro del extracto (0 = más antiguo). */
  statementOrder: number
  raw: Record<string, SheetCell>
}

export type BalanceMode = 'after' | 'before'

export type StatementParseResult = {
  provider: TreasuryProvider
  rows: StatementRow[]
  errors: string[]
  /** Cómo informa el saldo el banco original (los rows ya vienen normalizados a 'after'). */
  balanceMode: BalanceMode
}

export type TreasuryAccount = {
  id: string
  code: string
  name: string
  kind: TreasuryAccountKind
  provider: TreasuryProvider | null
  currency: string
  openingBalance: number
  openingDate: string | null
  isActive: boolean
  sortOrder: number
}

export type TreasuryCategory = {
  id: string
  name: string
  kind: TreasuryCategoryKind
  defaultScope: TreasuryScope | null
  isActive: boolean
  sortOrder: number
}

export type TreasuryRule = {
  id: string
  name: string
  matchType: TreasuryRuleMatchType
  pattern: string
  direction: TreasuryRuleDirection
  accountId: string | null
  categoryId: string | null
  scope: TreasuryScope | null
  transferAccountId: string | null
  priority: number
  isActive: boolean
}

export type TreasuryCounterparty = {
  id: string
  cuit: string
  name: string
  categoryId: string | null
  scope: TreasuryScope | null
  notes: string | null
}

export type TreasuryTransaction = {
  id: string
  accountId: string
  importBatchId: string | null
  source: TreasurySource
  txDate: string
  reference: string | null
  descriptionRaw: string
  descriptionNorm: string
  amount: number
  bankBalance: number | null
  statementOrder: number | null
  counterpartyCuit: string | null
  categoryId: string | null
  scope: TreasuryScope | null
  isInternal: boolean
  transferPairId: string | null
  classification: TreasuryClassification
  ruleId: string | null
  notes: string | null
  deletedAt: string | null
}

export type TreasuryImportBatch = {
  id: string
  accountId: string
  fileName: string
  dateFrom: string | null
  dateTo: string | null
  rowCount: number
  autoCount: number
  pendingCount: number
  skippedDuplicates: number
  balanceBreaks: number
  createdAt: string
  deletedAt: string | null
}

/** Resultado de clasificar un movimiento con contrapartes + reglas. */
export type ClassificationResult = {
  categoryId: string | null
  scope: TreasuryScope | null
  ruleId: string | null
  isInternal: boolean
  transferAccountId: string | null
  classification: TreasuryClassification
  matchedBy: 'counterparty' | 'rule' | null
}

export type ImportPreviewRow = StatementRow & {
  descriptionNorm: string
  counterpartyCuit: string | null
  dedupKey: string
  isDuplicate: boolean
  result: ClassificationResult
}

export type ImportPreview = {
  provider: TreasuryProvider
  accountId: string
  accountName: string
  fileName: string
  dateFrom: string | null
  dateTo: string | null
  rows: ImportPreviewRow[]
  newCount: number
  duplicateCount: number
  autoCount: number
  pendingCount: number
  balanceBreaks: number
  errors: string[]
}
