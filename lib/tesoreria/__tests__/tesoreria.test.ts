// Tests del módulo Tesorería: pnpm test:tesoreria
// Las fixtures imitan la estructura real de los extractos (datos ficticios).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectProvider, parseStatement } from '@/lib/tesoreria/parsers'
import {
  buildDedupKeys,
  classify,
  countBalanceBreaks,
  findInternalPairs,
  isValidRulePattern,
  manualClassification,
  suggestPattern,
} from '@/lib/tesoreria/engine'
import { extractCuit, isValidCuit, parseAmountCell, parseDateCell } from '@/lib/tesoreria/text'
import { accountBalances, summarize } from '@/lib/tesoreria/summary'
import type {
  SheetCell,
  TreasuryCategory,
  TreasuryRule,
  TreasuryTransaction,
} from '@/lib/tesoreria/types'

// Macro: fechas como serial de Excel, montos numéricos, saldo DESPUÉS del movimiento.
const MACRO: SheetCell[][] = [
  ['Últimos movimientos de CTA. CTE.BANCARIA', null, null, null, null],
  ['Número de cuenta 000000000000', null, null, null, null],
  ['Fecha', 'Nro. Transacción', 'Descripción', 'Importe', 'Saldo'],
  [46323, '1001', 'DB PAGO REMUNERACIONES', -500000, 1500000],
  [46323, '1000', 'TEF DATANET PR CLIENTE SA        30502793175', 2000000, 2000000],
  [46322, '999', 'COMISION CHEQUE CONSULTA', -1000, 0],
  [46322, '998', 'COMISION CHEQUE CONSULTA', -1000, 1000],
]

// Nación: fechas texto, montos "$ -1.234,56", saldo ANTES del movimiento.
const NACION: SheetCell[][] = [
  ['Banco Nación', '[BNA +]', '', '', ''],
  ['Últimos movimientos', '', '', '', ''],
  ['Fecha', 'Comprobante', 'Concepto', 'Monto', 'Saldo'],
  ['05/10/2026', '23203', 'DB TRANSFERENCIA ENVIADA - CUIT/CUIL: 27439099351', '$ -31.200,00', '$ 66.019,38'],
  ['05/10/2026', '23202', 'CPRA MERPAGO*FORRAJERIA', '$ -24.600,00', '$ 90.619,38'],
  ['01/10/2026', '0', 'INTERESES CAPITALIZADOS', '$ 678,94', '$ 89.940,44'],
]

const CATS: TreasuryCategory[] = [
  { id: 'c-clientes', name: 'Cobros de clientes', kind: 'income', defaultScope: 'empresa', isActive: true, sortOrder: 1 },
  { id: 'c-sueldos', name: 'Sueldos', kind: 'expense', defaultScope: 'empresa', isActive: true, sortOrder: 2 },
  { id: 'c-comis', name: 'Comisiones bancarias', kind: 'expense', defaultScope: 'empresa', isActive: true, sortOrder: 3 },
  { id: 'c-animales', name: 'Animales', kind: 'expense', defaultScope: 'personal', isActive: true, sortOrder: 4 },
  { id: 'c-efectivo', name: 'Movimiento de efectivo', kind: 'internal', defaultScope: null, isActive: true, sortOrder: 5 },
  { id: 'c-prov', name: 'Proveedores', kind: 'expense', defaultScope: 'empresa', isActive: true, sortOrder: 6 },
]

function rule(partial: Partial<TreasuryRule> & Pick<TreasuryRule, 'id' | 'pattern' | 'categoryId'>): TreasuryRule {
  return {
    name: partial.id,
    matchType: 'contains',
    direction: 'any',
    accountId: null,
    scope: null,
    transferAccountId: null,
    priority: 100,
    isActive: true,
    ...partial,
  }
}

const RULES: TreasuryRule[] = [
  rule({ id: 'r-datanet', pattern: 'TEF DATANET PR', categoryId: 'c-clientes', direction: 'in', priority: 20 }),
  rule({ id: 'r-sueldos', pattern: 'PAGO REMUNERACIONES', categoryId: 'c-sueldos', direction: 'out' }),
  rule({ id: 'r-comis', matchType: 'regex', pattern: 'COMISION|COMIS\\.', categoryId: 'c-comis', direction: 'out' }),
  rule({ id: 'r-forra', matchType: 'regex', pattern: 'FORRAJERIA|VETERINARIA', categoryId: 'c-animales', direction: 'out' }),
  rule({ id: 'r-atm', pattern: 'EXTRACCION CAJERO', categoryId: 'c-efectivo', transferAccountId: 'acc-cash', direction: 'out', priority: 10 }),
]

test('detecta el banco por los encabezados', () => {
  assert.equal(detectProvider(MACRO), 'macro')
  assert.equal(detectProvider(NACION), 'nacion')
  assert.equal(detectProvider([['Fecha', 'Algo', 'Otra cosa']]), null)
  assert.throws(() => parseStatement([['foo']]), /Formato no reconocido/)
})

test('parsea Macro: serial de Excel, montos y orden cronológico', () => {
  const r = parseStatement(MACRO)
  assert.equal(r.provider, 'macro')
  assert.equal(r.rows.length, 4)
  assert.equal(r.rows[0].txDate, '2026-10-28')
  assert.equal(r.rows[3].txDate, '2026-10-27')
  assert.equal(r.rows[0].statementOrder, 3) // el más nuevo
  assert.equal(r.rows[3].statementOrder, 0) // el más viejo
  assert.equal(r.rows[1].amount, 2000000)
  assert.equal(countBalanceBreaks(r.rows), 0)
})

test('parsea Nación: texto es-AR y normaliza saldo anterior → posterior', () => {
  const r = parseStatement(NACION)
  assert.equal(r.provider, 'nacion')
  assert.equal(r.balanceMode, 'before')
  assert.equal(r.rows.length, 3)
  assert.equal(r.rows[0].amount, -31200)
  assert.equal(r.rows[0].txDate, '2026-10-05')
  assert.equal(r.rows[2].reference, null) // comprobante "0" se descarta
  // saldo posterior = saldo anterior + monto
  assert.equal(r.rows[0].bankBalance, 34819.38)
  assert.equal(countBalanceBreaks(r.rows), 0)
})

test('detecta cortes de saldo (movimiento faltante)', () => {
  const r = parseStatement(MACRO)
  const sinUno = r.rows.filter((_, i) => i !== 1)
  assert.equal(countBalanceBreaks(sinUno), 1)
})

test('montos y fechas', () => {
  assert.equal(parseAmountCell('$ -1.875,64'), -1875.64)
  assert.equal(parseAmountCell('$ 500.000,00'), 500000)
  assert.equal(parseAmountCell('1.234'), 1234)
  assert.equal(parseAmountCell(-10.749999), -10.75)
  assert.equal(parseAmountCell('abc'), null)
  assert.equal(parseDateCell(46296), '2026-10-01')
  assert.equal(parseDateCell('01/11/2026'), '2026-11-01')
  assert.equal(parseDateCell('32/13/2026'), null)
})

test('CUIT: dígito verificador y extracción', () => {
  assert.ok(isValidCuit('30502793175'))
  assert.ok(!isValidCuit('26102100003'))
  assert.equal(extractCuit('TRANSF:2610280000975470772639-20144049900'), '20144049900')
  assert.equal(extractCuit('TEF DATANET PR ARCOR SAIC         30502793175'), '30502793175')
  assert.equal(extractCuit('DB TRANSFERENCIA ENVIADA - CUIT/CUIL: 27439099351'), '27439099351')
  assert.equal(extractCuit('CHEQUE P/CAMARA'), null)
})

test('deduplicación: movimientos idénticos del mismo día no colisionan', () => {
  const r = parseStatement(MACRO)
  const keys = buildDedupKeys(r.rows)
  assert.equal(new Set(keys).size, 4)
  // Reimportar el mismo extracto genera las mismas claves
  assert.deepEqual(buildDedupKeys(parseStatement(MACRO).rows), keys)
})

test('clasificación por reglas, ámbito por defecto y pendientes', () => {
  const base = { accountId: 'acc-macro', counterpartyCuit: null }
  const sueldo = classify({ ...base, descriptionNorm: 'DB PAGO REMUNERACIONES', amount: -1 }, RULES, [], CATS)
  assert.equal(sueldo.categoryId, 'c-sueldos')
  assert.equal(sueldo.scope, 'empresa')
  assert.equal(sueldo.classification, 'auto')

  const forraje = classify({ ...base, descriptionNorm: 'CPRA MERPAGO*FORRAJERIA', amount: -1 }, RULES, [], CATS)
  assert.equal(forraje.scope, 'personal')

  // Dirección: una regla de egresos no matchea un ingreso
  const comisionIngreso = classify({ ...base, descriptionNorm: 'COMISION DEVUELTA', amount: 10 }, RULES, [], CATS)
  assert.equal(comisionIngreso.classification, 'pending')

  const nada = classify({ ...base, descriptionNorm: 'CHEQUE P/CAMARA', amount: -1 }, RULES, [], CATS)
  assert.equal(nada.classification, 'pending')
  assert.equal(nada.matchedBy, null)
})

test('extracción de cajero: interna con espejo en Efectivo', () => {
  const r = classify(
    { descriptionNorm: 'EXTRACCION CAJERO AUTOMATICO', amount: -530000, accountId: 'acc-macro', counterpartyCuit: null },
    RULES, [], CATS
  )
  assert.equal(r.isInternal, true)
  assert.equal(r.scope, null)
  assert.equal(r.transferAccountId, 'acc-cash')
  assert.equal(r.classification, 'auto')
})

test('la contraparte por CUIT tiene prioridad sobre las reglas', () => {
  const r = classify(
    { descriptionNorm: 'TEF DATANET PR PROVEEDOR 30623608677', amount: 100, accountId: 'a', counterpartyCuit: '30623608677' },
    RULES,
    [{ id: 'cp1', cuit: '30623608677', name: 'Proveedor', categoryId: 'c-prov', scope: null, notes: null }],
    CATS
  )
  assert.equal(r.matchedBy, 'counterparty')
  assert.equal(r.categoryId, 'c-prov')
  assert.equal(r.scope, 'empresa')
})

test('validación de patrones y sugerencia', () => {
  assert.ok(isValidRulePattern('regex', 'YPF|SHELL'))
  assert.ok(!isValidRulePattern('regex', '(abc'))
  assert.ok(isValidRulePattern('cuit', '30502793175'))
  assert.ok(!isValidRulePattern('cuit', '305'))
  assert.equal(suggestPattern('RET IIBB TUCUMAN SUC.:140'), 'RET IIBB TUCUMAN')
  assert.equal(suggestPattern('TRANSF:2610280000975470772639-20144049900'), 'TRANSF')
})

test('clasificación manual: interno no lleva ámbito', () => {
  const internal = CATS.find((c) => c.id === 'c-efectivo')
  assert.deepEqual(manualClassification('c-efectivo', 'empresa', internal), {
    scope: null, isInternal: true, classification: 'manual',
  })
  const sinAmbito = manualClassification(null, null, undefined)
  assert.equal(sinAmbito.classification, 'pending')
})

test('transferencias internas sugeridas entre cuentas distintas (±2 días)', () => {
  const pairs = findInternalPairs([
    { id: 'o1', accountId: 'macro', txDate: '2026-10-01', amount: -9000, isInternal: false },
    { id: 'i1', accountId: 'nacion', txDate: '2026-10-02', amount: 9000, isInternal: false },
    { id: 'o2', accountId: 'macro', txDate: '2026-10-01', amount: -500, isInternal: false },
    { id: 'i2', accountId: 'macro', txDate: '2026-10-01', amount: 500, isInternal: false }, // misma cuenta
    { id: 'i3', accountId: 'nacion', txDate: '2026-10-10', amount: 500, isInternal: false }, // muy lejos
  ])
  assert.deepEqual(pairs, [{ outId: 'o1', inId: 'i1', amount: 9000, daysApart: 1 }])
})

function tx(p: Partial<TreasuryTransaction>): TreasuryTransaction {
  return {
    id: Math.random().toString(36),
    accountId: 'acc',
    importBatchId: null,
    source: 'import',
    txDate: '2026-10-01',
    reference: null,
    descriptionRaw: '',
    descriptionNorm: '',
    amount: 0,
    bankBalance: null,
    statementOrder: null,
    counterpartyCuit: null,
    categoryId: null,
    scope: null,
    isInternal: false,
    transferPairId: null,
    classification: 'auto',
    ruleId: null,
    notes: null,
    deletedAt: null,
    ...p,
  }
}

test('resumen: excluye internos y separa empresa / personal', () => {
  const txs = [
    tx({ amount: 1000, categoryId: 'c-clientes', scope: 'empresa' }),
    tx({ amount: -300, categoryId: 'c-sueldos', scope: 'empresa' }),
    tx({ amount: -100, categoryId: 'c-animales', scope: 'personal' }),
    tx({ amount: -5000, categoryId: 'c-efectivo', isInternal: true }),
    tx({ amount: -50, classification: 'pending' }),
    tx({ amount: -999, deletedAt: '2026-10-02' }),
  ]
  const all = summarize(txs, CATS, 'todo')
  assert.equal(all.income, 1000)
  assert.equal(all.expense, 450)
  assert.equal(all.personalExpense, 100)
  assert.equal(all.personalShareOfIncome, 0.1)
  assert.equal(all.pendingCount, 1)

  const empresa = summarize(txs, CATS, 'empresa')
  assert.equal(empresa.expense, 300)
  const personal = summarize(txs, CATS, 'personal')
  assert.equal(personal.expense, 100)
  assert.equal(personal.income, 0)
})

test('saldos por cuenta: inicial + movimientos y último saldo del banco', () => {
  const balances = accountBalances(
    [{ id: 'acc', code: 'macro', name: 'Macro', kind: 'bank', provider: 'macro', currency: 'ARS', openingBalance: 100, openingDate: '2026-10-01', isActive: true, sortOrder: 1 }],
    [
      tx({ amount: 50, bankBalance: 150, txDate: '2026-10-02', statementOrder: 0 }),
      tx({ amount: -20, bankBalance: 130, txDate: '2026-10-02', statementOrder: 1 }),
      tx({ amount: 999, txDate: '2026-09-30' }), // antes de la apertura
    ]
  )
  assert.equal(balances[0].systemBalance, 130)
  assert.equal(balances[0].lastBankBalance, 130)
})
