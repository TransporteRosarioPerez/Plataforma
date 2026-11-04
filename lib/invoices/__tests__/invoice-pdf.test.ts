// Tests de la lectura de facturas de ARCA: pnpm test:facturacion
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeArcaInvoice, parseArcaInvoice } from '@/lib/invoices/parse-arca-pdf'
import { calculateInvoiceAmounts, invoiceIvaTolerance } from '@/lib/invoices/calculate'
import { parseArAmount, parseUsAmount, roundCents } from '@/lib/pdf/numbers'

// Estructura de una FCE A (datos ficticios con los importes del caso real)
const PAGE_1 = [
  'EMPRESA EJEMPLO A FACTURA DE CRÉDITO ELECTRÓNICA',
  'CÓD. 201 MiPyMEs (FCE)',
  'Punto de Venta: 00002 Comp. Nro: 00000250',
  'Razón Social: EMPRESA EJEMPLO Fecha de Emisión: 21/10/2026',
  'CUIT: 27000000001',
  'CUIT: 30502793175 Apellido y Nombre / Razón Social: CLIENTE S A',
  'Servicios de fletes Proforma 183853 Corte de 1,00 unidades 1324617,96 0,00 1324617,96 21% 1602787,73',
  'proforma 963037 Compañía 01 Jurisdiccion 02',
  'Transportista 255411 Empresa Ejemplo',
  'Servicios de fletes Proforma 183853 Corte de 1,00 unidades 7657272,37 0,00 7657272,37 21% 9265299,57',
  'Servicios de fletes Proforma 183853 Corte de 1,00 unidades 1441215,02 0,00 1441215,02 21% 1743870,17',
  'Servicios de fletes Proforma 183853 Corte de 1,00 unidades 5137930,02 0,00 5137930,02 21% 6216895,32',
  'Servicios de fletes Proforma 183853 Corte de 1,00 unidades 13690935,34 0,00 13690935,34 21% 16566031,76',
  'Servicios de fletes Proforma 183853 Corte de 1,00 unidades 86708215,34 0,00 86708215,34 21% 104916940,56',
  'Servicios de fletes Proforma 183853 Corte de 1,00 unidades 266693,54 0,00 266693,54 21% 322699,18',
  'Subtotal: 140634524,29',
]
const PAGE_2 = [
  'TRANSPORTE: 140634524,29',
  'Importe Otros Tributos: $ 0,00',
  'Importe Neto Gravado: $ 116226879,59',
  'IVA 27%: $ 0,00',
  'IVA 21%: $ 24407644,70',
  'IVA 10.5%: $ 0,00',
  'Importe Total: $ 140634524,29',
]

test('números en formato Arcor y ARCA', () => {
  assert.equal(parseUsAmount('1,324,617.96'), 1324617.96)
  assert.equal(parseUsAmount('**********'), null)
  assert.equal(parseArAmount('116226879,59'), 116226879.59)
  assert.equal(parseArAmount('$ 116.226.879,59'), 116226879.59)
  assert.equal(roundCents(116226879.58999997), 116226879.59)
})

test('lee el pie de la factura tal como lo autorizó ARCA', () => {
  const inv = parseArcaInvoice([PAGE_1, PAGE_2])
  assert.equal(looksLikeArcaInvoice([PAGE_1, PAGE_2]), true)
  assert.deepEqual(inv.errors, [])
  assert.equal(inv.invoiceNumber, '00002-00000250')
  assert.equal(inv.invoiceType, 'A')
  assert.equal(inv.issueDate, '2026-10-21')
  assert.equal(inv.issuerCuit, '27000000001')
  assert.equal(inv.clientCuit, '30502793175')
  assert.equal(inv.neto, 116226879.59)
  assert.equal(inv.iva, 24407644.7)
  assert.equal(inv.total, 140634524.29)
  assert.deepEqual(inv.proformaRefs, ['183853'])
  assert.deepEqual(inv.proformaNumbers, ['183853-01-02'])
  assert.equal(inv.lines.length, 7)
})

test('IVA de ARCA (por línea) vs recálculo sobre el neto: 1 centavo de diferencia', () => {
  const inv = parseArcaInvoice([PAGE_1, PAGE_2])
  const calc = calculateInvoiceAmounts(inv.neto!)
  assert.equal(calc.iva, 24407644.71)
  const diff = Math.abs(calc.iva - inv.iva!)
  assert.ok(diff > 0 && diff <= invoiceIvaTolerance(inv.lines.length))
})

test('factura de una proforma de Bagley de un solo corte', () => {
  const inv = parseArcaInvoice([
    [
      'Punto de Venta: 00002 Comp. Nro: 00000803',
      'CÓD. 001',
      'Fecha de Emisión: 21/10/2026',
      'CUIT: 27000000001',
      'CUIT: 30708895780 Apellido y Nombre / Razón Social: BAGLEY ARGENTINA S A',
      'Servicios de fletes Proforma 183853 Corte de 1,00 unidades 1015759,03 0,00 1015759,03 21% 1229068,43',
      'proforma 963099 Compañía 33 Jurisdiccion 04',
      'Importe Neto Gravado: $ 1015759,03',
      'IVA 21%: $ 213309,40',
      'Importe Total: $ 1229068,43',
    ],
  ])
  assert.deepEqual(inv.errors, [])
  assert.equal(inv.invoiceType, 'A')
  assert.equal(inv.invoiceNumber, '00002-00000803')
  assert.deepEqual(inv.proformaNumbers, ['183853-33-04'])
  assert.deepEqual(inv.proformaRefs, ['183853'])
})

// ---- Importar varias facturas ----
import {
  assessInvoiceImport,
  matchInvoiceToProforma,
  normalizeInvoiceNumber,
  type BillableProforma,
} from '@/lib/invoices/pdf-import'

const BILLABLE: BillableProforma[] = [
  { id: 'p1', proformaNumber: '183853-01-02', clientId: 'arcor', clientName: 'Arcor', clientCuit: '30502793175', subtotal: 116226879.59 },
  { id: 'p2', proformaNumber: '183853-33-04', clientId: 'bagley', clientName: 'Bagley', clientCuit: '30708895780', subtotal: 1015759.03 },
  { id: 'p3', proformaNumber: '183853-01-03', clientId: 'arcor', clientName: 'Arcor', clientCuit: '30502793175', subtotal: 1015759.03 },
]

test('vincula por el número de proforma del detalle', () => {
  const inv = parseArcaInvoice([PAGE_1, PAGE_2])
  const m = matchInvoiceToProforma(inv, BILLABLE, new Set())
  assert.equal(m.proformaId, 'p1')
  assert.equal(m.via, 'numero')
  const a = assessInvoiceImport(inv, BILLABLE[0], {
    duplicateInvoiceNumber: false,
    alreadyInvoicedProforma: null,
    proformaTakenByAnother: false,
  })
  assert.equal(a.status, 'ready', a.problems.join('; '))
})

test('sin número en el detalle: por neto + CUIT (dos proformas con el mismo neto)', () => {
  const m = matchInvoiceToProforma(
    { neto: 1015759.03, clientCuit: '30708895780', proformaNumbers: [] },
    BILLABLE,
    new Set()
  )
  assert.equal(m.proformaId, 'p2')
  assert.equal(m.via, 'neto')
  const amb = matchInvoiceToProforma({ neto: 1015759.03, clientCuit: null, proformaNumbers: [] }, BILLABLE, new Set())
  assert.equal(amb.proformaId, null)
  assert.deepEqual(amb.candidateIds, ['p2', 'p3'])
})

test('factura repetida o proforma ya facturada: se saltea', () => {
  assert.equal(normalizeInvoiceNumber('00002-00000250'), normalizeInvoiceNumber('0000200000250'))
  const inv = parseArcaInvoice([PAGE_1, PAGE_2])
  const m = matchInvoiceToProforma(inv, BILLABLE.slice(1), new Set(['183853-01-02']))
  assert.equal(m.alreadyInvoicedProforma, '183853-01-02')
  const a = assessInvoiceImport(inv, null, {
    duplicateInvoiceNumber: false,
    alreadyInvoicedProforma: m.alreadyInvoicedProforma,
    proformaTakenByAnother: false,
  })
  assert.equal(a.status, 'existing')
})

test('neto distinto al de la proforma bloquea', () => {
  const inv = parseArcaInvoice([PAGE_1, PAGE_2])
  const a = assessInvoiceImport(inv, { ...BILLABLE[0], subtotal: 116226969.59 }, {
    duplicateInvoiceNumber: false,
    alreadyInvoicedProforma: null,
    proformaTakenByAnother: false,
  })
  assert.equal(a.status, 'problems')
  assert.equal(a.netoDiff, -90)
})
