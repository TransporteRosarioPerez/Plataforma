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
  assert.equal(inv.lines.length, 7)
})

test('IVA de ARCA (por línea) vs recálculo sobre el neto: 1 centavo de diferencia', () => {
  const inv = parseArcaInvoice([PAGE_1, PAGE_2])
  const calc = calculateInvoiceAmounts(inv.neto!)
  assert.equal(calc.iva, 24407644.71)
  const diff = Math.abs(calc.iva - inv.iva!)
  assert.ok(diff > 0 && diff <= invoiceIvaTolerance(inv.lines.length))
})
