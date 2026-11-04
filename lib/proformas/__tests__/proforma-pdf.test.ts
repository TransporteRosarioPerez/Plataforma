// Tests de la lectura de proformas de Arcor: pnpm test:facturacion
// Las fixtures imitan la estructura real del PDF (datos ficticios).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupTextItemsIntoLines } from '@/lib/pdf/text-lines'
import { parseArcorProforma, looksLikeArcorProforma } from '@/lib/proformas/parse-arcor-pdf'
import { reviewProformaPdf, type TripMatch } from '@/lib/proformas/pdf-review'

const header = (corte: string, company = '00001 ARCOR S.A.I.C.', cuit = '30502793175', jur = '02') => [
  'HOJA NRO 1 de 22 RESUMEN DE VIAJES PROFORMADOS 19/10/26',
  'R5949039 GRUPO ARCOR',
  'NRO PROFORMA 183853',
  `NRO CORTE POR PROFORMA ${corte}`,
  `COMPAÑIA ${company}`,
  `CUIT ${cuit}`,
  'DIRECCION LEGAL AV. SIEMPRE VIVA 123',
  `JURISDICCION ${jur}`,
  'Fecha de Vehiculo Numero de Ciudad Origen Ciudad Destino Valor Cant. UM Satelital Vacio Varios Ajustes Adicionales Importe No Importe Importe',
]

const PAGES: string[][] = [
  [
    ...header('900001'),
    '27/01/26 AA000AA-00 22400001 EZEIZA (B.A.) RIO GALLEGOS 100,000.00 30.00 PL 1,000,000.00 1,000,000.00',
    '(S.C.)',
    'TOTALES 1,000,000.00 1,000,000.00',
  ],
  [
    ...header('900002'),
    '06/05/26 AA000AA-00 22400002 EL TALAR DE MAR DEL PLATA 43,486.20 30.00 PL 19,568.79 178,392.50 178,392.50',
    '12/05/26 BB111BB-00 22400003 EZEIZA (B.A.) GENERAL MOSCONI 289,266.51 30.00 PL ********** 6,910,030.82 6,910,030.82',
  ],
  [
    // Hoja de continuación: sin encabezado
    'HOJA NRO 3 de 22 RESUMEN DE VIAJES PROFORMADOS 19/10/26',
    '23/09/26 CC222CC-01 4246863 AZUL (B.A.) EL TALAR DE 16,163.05 30.00 TN 484,891.38 484,891.38',
    'TOTALES 7,573,314.70 7,573,314.70',
  ],
  [
    ...header('900003', '00033 BAGLEY ARGENTINA S.A.', '30708895780'),
    '15/09/26 AA000AA-00 22400002 EL TALAR DE MAR DEL PLATA 10,000.00 30.00 PL 300,000.00 300,000.00',
    'TOTALES 300,000.00 300,000.00',
  ],
]

test('agrupa ítems sueltos del PDF en renglones', () => {
  const lines = groupTextItemsIntoLines([
    { str: 'TOTALES', x: 500, y: 100 },
    { str: '1,000.00', x: 700, y: 101 },
    { str: '27/01/26', x: 10, y: 120 },
    { str: '22400001', x: 80, y: 119.5 },
    { str: ' ', x: 60, y: 120 },
  ])
  assert.deepEqual(lines, ['27/01/26 22400001', 'TOTALES 1,000.00'])
})

test('lee proforma, cortes, continuación y separa compañías', () => {
  assert.equal(looksLikeArcorProforma(PAGES), true)
  const { groups, errors } = parseArcorProforma(PAGES)
  assert.deepEqual(errors, [])
  assert.deepEqual(groups.map((g) => g.proformaNumber), ['183853-01-02', '183853-33-02'])

  const arcor = groups[0]
  assert.equal(arcor.cuit, '30502793175')
  assert.equal(arcor.issueDate, '2026-10-19')
  assert.equal(arcor.rows.length, 4)
  assert.deepEqual(
    arcor.rows.map((r) => [r.corte, r.code, r.amount]),
    [
      ['900001', '22400001', 1000000],
      ['900002', '22400002', 178392.5],
      ['900002', '22400003', 6910030.82],
      ['900002', '4246863', 484891.38],
    ]
  )
  assert.equal(arcor.rows[3].date, '2026-09-23')
  assert.equal(arcor.rows[3].plate, 'CC222CC-01')
  assert.deepEqual(arcor.cortes, [
    { corte: '900001', rowsTotal: 1000000, printedTotal: 1000000 },
    { corte: '900002', rowsTotal: 7573314.7, printedTotal: 7573314.7 },
  ])
  assert.equal(arcor.total, 8573314.7)
  assert.equal(groups[1].total, 300000)
  assert.equal(groups[1].companyName, 'BAGLEY ARGENTINA S.A.')
})

test('avisa si una fila aparece sin encabezado', () => {
  const { errors } = parseArcorProforma([['27/01/26 AA000AA-00 22400001 X Y 1,000.00 1,000.00']])
  assert.equal(errors.length, 2)
})

const match = (code: string, kind: TripMatch['kind'] = 'free'): TripMatch => ({
  tripId: `t-${code}`,
  code,
  status: 'delivered',
  kind,
  otherProformas: [],
})

test('revisión OK cuando cada viaje coincide al centavo', () => {
  const group = parseArcorProforma(PAGES).groups[0]
  const matches = Object.fromEntries(group.rows.map((r) => [r.code, match(r.code)]))
  const lines = new Map(group.rows.map((r) => [`t-${r.code}`, r.amount]))
  const review = reviewProformaPdf(group, matches, lines)
  assert.equal(review.ok, true, review.problems.join('; '))
  assert.equal(review.diff, 0)
})

test('detecta el error de dígitos invertidos (caso real 484.891,38 vs 484.981,38)', () => {
  const group = parseArcorProforma(PAGES).groups[0]
  const matches = Object.fromEntries(group.rows.map((r) => [r.code, match(r.code)]))
  const lines = new Map(group.rows.map((r) => [`t-${r.code}`, r.amount]))
  lines.set('t-4246863', 484981.38)
  const review = reviewProformaPdf(group, matches, lines)
  assert.equal(review.ok, false)
  assert.equal(review.diff, 90)
  const row = review.rows.find((r) => r.row.code === '4246863')!
  assert.equal(row.state, 'amount_diff')
  assert.equal(review.cortes.find((c) => c.corte === '900002')!.ok, false)
  assert.equal(review.cortes.find((c) => c.corte === '900001')!.ok, true)
})

test('viajes sin cargar, faltantes y de más bloquean el guardado', () => {
  const group = parseArcorProforma(PAGES).groups[0]
  const matches: Record<string, TripMatch | null> = {
    '22400001': match('22400001'),
    '22400002': match('22400002', 'adjustment'),
    '22400003': null,
    '4246863': match('4246863'),
  }
  const lines = new Map<string, number>([
    ['t-22400001', 1000000],
    ['t-22400002', 178392.5],
    ['t-otro', 5],
  ])
  const review = reviewProformaPdf(group, matches, lines)
  assert.equal(review.ok, false)
  assert.deepEqual(
    review.rows.map((r) => r.state),
    ['ok', 'ok', 'missing_trip', 'not_in_proforma']
  )
  assert.deepEqual(review.extraTripIds, ['t-otro'])
})

test('marca un PDF cuyas filas no dan el TOTALES impreso', () => {
  const pages = [[...header('900009'), '01/01/26 AA-00 22400009 A B 100.00 100.00', 'TOTALES 100.01 100.01']]
  const group = parseArcorProforma(pages).groups[0]
  const review = reviewProformaPdf(group, { '22400009': match('22400009') }, new Map([['t-22400009', 100]]))
  assert.equal(review.cortes[0].pdfInconsistent, true)
  assert.equal(review.ok, false)
})
