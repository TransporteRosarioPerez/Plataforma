import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  companyDomainFromEmail,
  normalizeCompanyName,
  normalizeCuit,
  normalizePhone,
} from '../normalize'
import { findCompanyCandidates, findDuplicateCompanies, nameSimilarity, STRONG_MATCH, type MatchCatalog } from '../matching'
import { parseRequestText, stripWhatsAppHeaders } from '../parse'
import { suggestPrice } from '../pricing'
import { buildQuoteMessage, whatsappLink } from '../quote-message'
import { computeMetrics, weekStart } from '../metrics'
import type { CrmQuote } from '../types'

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

test('normalizeCompanyName saca sufijos societarios, acentos y "Argentina"', () => {
  assert.equal(normalizeCompanyName('LENOVO ARGENTINA S.R.L.'), 'lenovo')
  assert.equal(normalizeCompanyName('Lenovo'), 'lenovo')
  assert.equal(normalizeCompanyName('Arcor S. A. I. C.'), 'arcor')
  assert.equal(normalizeCompanyName('Complejo Alimenticio San Salvador S.A.'), 'complejo alimenticio san salvador')
  assert.equal(normalizeCompanyName('Lácteos Verónica SA'), 'lacteos veronica')
  assert.equal(normalizeCompanyName('Argentina'), 'argentina')
  assert.equal(normalizeCompanyName('Johnson & Johnson'), 'johnson johnson')
  assert.equal(normalizeCompanyName(''), '')
})

test('normalizePhone unifica formatos argentinos', () => {
  assert.equal(normalizePhone('+54 9 3329 64-3639'), '3329643639')
  assert.equal(normalizePhone('03329 15 643639'), '3329643639')
  assert.equal(normalizePhone('3329643639'), '3329643639')
  assert.equal(normalizePhone('+54 11 4444-5555'), '1144445555')
  assert.equal(normalizePhone('011 15 4444 5555'), '1144445555')
  assert.equal(normalizePhone('1234'), null)
})

test('normalizeCuit valida dígito verificador', () => {
  assert.equal(normalizeCuit('27-22476062-6'), '27224760626')
  assert.equal(normalizeCuit('27-22476062-5'), null)
  assert.equal(normalizeCuit('123'), null)
})

test('companyDomainFromEmail ignora casillas genéricas', () => {
  assert.equal(companyDomainFromEmail('Juan@Lenovo.com'), 'lenovo.com')
  assert.equal(companyDomainFromEmail('juan@gmail.com'), null)
  assert.equal(companyDomainFromEmail('transporterosarioperez@yahoo.com.ar'), null)
})

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const catalog: MatchCatalog = {
  companies: [
    { id: 'lenovo', name: 'Lenovo', nameNorm: 'lenovo', cuit: '30711111111', emailDomain: 'lenovo.com' },
    { id: 'arcor', name: 'Arcor', nameNorm: 'arcor', cuit: null, emailDomain: 'arcor.com' },
    { id: 'css', name: 'Complejo Alimenticio San Salvador', nameNorm: 'complejo alimenticio san salvador', cuit: null, emailDomain: null },
    { id: 'ml', name: 'Mercado Libre', nameNorm: 'mercado libre', cuit: null, emailDomain: null },
    { id: 'ypf', name: 'YPF', nameNorm: 'ypf', cuit: null, emailDomain: null },
  ],
  aliases: [{ companyId: 'css', alias: 'San Salvador', aliasNorm: 'san salvador' }],
  contacts: [{ companyId: 'arcor', email: 'compras@gmail.com', phoneNorm: '3415556677' }],
}

test('nameSimilarity: errores de tipeo altos, empresas distintas bajos', () => {
  assert.ok(nameSimilarity('lenevo', 'lenovo') >= 0.85, `lenevo ${nameSimilarity('lenevo', 'lenovo')}`)
  assert.ok(nameSimilarity('mercadolibre', 'mercado libre') >= 0.95)
  assert.ok(nameSimilarity('arcor', 'acor') >= 0.8)
  assert.ok(nameSimilarity('lenovo', 'arcor') < 0.6)
  assert.equal(nameSimilarity('ypf', 'ypx'), 0, 'siglas cortas sólo exactas')
  assert.ok(nameSimilarity('la serenisima', 'mastellone') < 0.6)
})

test('Lenevo sugiere Lenovo como coincidencia fuerte', () => {
  const [best] = findCompanyCandidates({ companyName: 'Lenevo S.A.' }, catalog)
  assert.equal(best.companyId, 'lenovo')
  assert.ok(best.score >= 0.85 && best.score < 1)
  assert.equal(best.reasons[0].kind, 'similar')
})

test('mail corporativo gana aunque el nombre esté mal escrito', () => {
  const [best] = findCompanyCandidates({ companyName: 'Lnv', emails: ['ana@lenovo.com'] }, catalog)
  assert.equal(best.companyId, 'lenovo')
  assert.ok(best.score >= STRONG_MATCH)
})

test('CUIT, alias, teléfono y mail de contacto', () => {
  assert.equal(findCompanyCandidates({ cuit: '30-71111111-1' }, catalog)[0].companyId, 'lenovo')
  assert.equal(findCompanyCandidates({ companyName: 'San Salvador' }, catalog)[0].companyId, 'css')
  assert.equal(findCompanyCandidates({ phones: ['+54 9 341 555-6677'] }, catalog)[0].companyId, 'arcor')
  assert.equal(findCompanyCandidates({ emails: ['COMPRAS@gmail.com'] }, catalog)[0].companyId, 'arcor')
})

test('empresa nueva: sin candidatos', () => {
  assert.deepEqual(findCompanyCandidates({ companyName: 'Frigorífico Paladini', emails: ['x@gmail.com'] }, catalog), [])
})

test('findDuplicateCompanies detecta Lenovo / Lenevo', () => {
  const pairs = findDuplicateCompanies([
    ...catalog.companies,
    { id: 'lenevo', name: 'Lenevo', nameNorm: 'lenevo', cuit: null, emailDomain: null },
  ])
  assert.equal(pairs.length, 1)
  assert.deepEqual([pairs[0].a, pairs[0].b].sort(), ['lenevo', 'lenovo'])
})

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const ref = new Date(2026, 10, 2) // 02/11/2026

test('WhatsApp pegado: remitente, ruta, pallets, servicio y fecha', () => {
  const msg = `[2/11/26, 10:15:32] Juan Pérez: Buen día, les escribo de Lenevo. Necesito cotizar 12 pallets refrigerados desde Buenos Aires a Salta para el 10/11
[2/11/26, 10:16:01] Juan Pérez: es semanal`
  const p = parseRequestText(msg, ref)
  assert.equal(p.senderName, 'Juan Pérez')
  assert.equal(p.companyName, 'Lenevo')
  assert.equal(p.pallets, 12)
  assert.equal(p.loadType, 'parcial')
  assert.equal(p.serviceType, 'refrigerado')
  assert.equal(p.origin, 'Buenos Aires')
  assert.equal(p.destination, 'Salta')
  assert.equal(p.destinationProvince, 'Salta')
  assert.equal(p.loadDate, '2026-11-10')
  assert.equal(p.frequency, 'semanal')
})

test('Mail: firma, dominio, CUIT, teléfono, semi completo congelado', () => {
  const msg = `Hola, buenas tardes.
Quisiera cotización de un semi completo de congelado (-18°) con destino Villa Ángela, Chaco. Carga en Pilar el 5/11.
Peso aprox 24 tn.

Saludos,
María Gómez
Frigorífico del Sur S.A.
CUIT 27-22476062-6
Tel: 011 15 4444-5555
maria.gomez@frigosur.com.ar`
  const p = parseRequestText(msg, ref)
  assert.equal(p.senderName, 'María Gómez')
  assert.equal(p.companyName, 'Frigorífico del Sur S.A.')
  assert.equal(p.cuit, '27224760626')
  assert.deepEqual(p.emails, ['maria.gomez@frigosur.com.ar'])
  assert.equal(p.phones?.length, 1)
  assert.equal(p.serviceType, 'congelado')
  assert.equal(p.loadType, 'completa')
  assert.equal(p.pallets, 30)
  assert.equal(p.destination, 'Villa Ángela')
  assert.equal(p.destinationProvince, 'Chaco')
  assert.equal(p.origin, 'Pilar')
  assert.equal(p.weightKg, 24000)
  assert.equal(p.loadDate, '2026-11-05')
})

test('Sin nombre de empresa usa el dominio del mail', () => {
  const p = parseRequestText('Precio para 4 pallets a Neuquén? contacto: ventas@lacteosnorte.com', ref)
  assert.equal(p.companyName, 'Lacteosnorte')
  assert.equal(p.destination, 'Neuquén')
  assert.equal(p.pallets, 4)
})

test('"desde Córdoba" no se toma como empresa; fecha sin año pasada va al año siguiente', () => {
  const p = parseRequestText('Te escribo desde Córdoba, necesito llevar 8 pallets de Córdoba a Mendoza el 15/01', ref)
  assert.equal(p.companyName, undefined)
  assert.equal(p.origin, 'Córdoba')
  assert.equal(p.destination, 'Mendoza')
  assert.equal(p.loadDate, '2027-01-15')
})

test('stripWhatsAppHeaders con formato Android', () => {
  const r = stripWhatsAppHeaders('2/11/26 10:15 - Pedro: hola\n2/11/26 10:16 - Pedro: 3 pallets')
  assert.equal(r.sender, 'Pedro')
  assert.equal(r.text, 'hola\n3 pallets')
})

// ---------------------------------------------------------------------------
// Precio y mensaje
// ---------------------------------------------------------------------------

const rate = { province: 'Salta', pricePerPallet: 100000, priceFullTruck: 2500000, frozenSurchargePct: 10, isActive: true }

test('suggestPrice: parcial, tope y congelado', () => {
  assert.equal(suggestPrice(rate, { pallets: 12, loadType: 'parcial', serviceType: 'refrigerado' })?.amount, 1200000)
  assert.equal(suggestPrice(rate, { pallets: 28, loadType: 'parcial', serviceType: 'refrigerado' })?.amount, 2500000)
  assert.equal(suggestPrice(rate, { pallets: null, loadType: 'completa', serviceType: 'congelado' })?.amount, 2750000)
  assert.equal(suggestPrice({ ...rate, pricePerPallet: null, priceFullTruck: null }, { pallets: 3, loadType: null, serviceType: null }), null)
  assert.equal(suggestPrice(null, { pallets: 3, loadType: null, serviceType: null }), null)
})

test('buildQuoteMessage y whatsappLink', () => {
  const text = buildQuoteMessage({
    number: 7, contactName: 'Juan Pérez', serviceType: 'refrigerado', loadType: 'parcial', pallets: 12, weightKg: null,
    origin: 'Buenos Aires', destination: 'Salta', loadDate: '2026-11-10', frequency: 'semanal', quotedAmount: 1200000, validUntil: '2026-11-09',
  })
  assert.match(text, /^Hola Juan, te paso la cotización COT-0007/)
  assert.match(text, /Buenos Aires → Salta/)
  assert.match(text, /\+ IVA por viaje/)
  assert.match(text, /no incluye seguro sobre la mercadería/)
  assert.equal(whatsappLink('03329 64-3639', 'hola'), 'https://wa.me/5493329643639?text=hola')
  assert.equal(whatsappLink('+54 9 3329 643639', 'x'), 'https://wa.me/5493329643639?text=x')
})

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

function quote(over: Partial<CrmQuote>): CrmQuote {
  return {
    id: Math.random().toString(36), number: 1, companyId: 'lenovo', companyName: 'Lenovo', contactId: null, contactName: null,
    contactEmail: null, contactPhone: null, inboundRequestId: 'r', channel: 'whatsapp', stage: 'nuevo',
    stageChangedAt: '2026-11-02T13:00:00Z', position: 0, receivedAt: '2026-11-02T13:00:00Z', serviceType: 'refrigerado',
    loadType: null, origin: null, destination: 'Salta', destinationProvince: 'Salta', pallets: 10, weightKg: null, loadDate: null,
    frequency: null, description: null, suggestedAmount: null, quotedAmount: 1000, sentAt: null, decidedAt: null, validUntil: null,
    lostReason: null, lostNotes: null, nextFollowupAt: null, createdAt: '2026-11-02T13:00:00Z', ...over,
  }
}

test('computeMetrics: conversión, respuesta en el día y canales', () => {
  const m = computeMetrics(
    {
      requests: [
        { id: 'r1', channel: 'whatsapp', status: 'accepted', receivedAt: '2026-11-02T13:00:00Z', companyId: 'lenovo' },
        { id: 'r2', channel: 'landing', status: 'accepted', receivedAt: '2026-11-02T14:00:00Z', companyId: 'arcor' },
        { id: 'r3', channel: 'email', status: 'discarded', receivedAt: '2026-11-03T14:00:00Z', companyId: null },
      ],
      quotes: [
        quote({ stage: 'ganada', sentAt: '2026-11-02T16:00:00Z', decidedAt: '2026-11-04T12:00:00Z', quotedAmount: 5000 }),
        quote({ companyId: 'arcor', channel: 'landing', stage: 'perdida', lostReason: 'Precio', sentAt: '2026-11-03T15:00:00Z', decidedAt: '2026-11-05T12:00:00Z' }),
        quote({ stage: 'enviada', sentAt: '2026-11-02T20:00:00Z', quotedAmount: 700 }),
      ],
      companies: [
        { id: 'lenovo', name: 'Lenovo', createdAt: '2026-11-02T13:00:00Z' },
        { id: 'arcor', name: 'Arcor', createdAt: '2025-01-01T00:00:00Z' },
      ],
    },
    '2026-11-01',
    '2026-11-30',
  )
  assert.equal(m.requests, 3)
  assert.equal(m.discarded, 1)
  assert.equal(m.companies, 2)
  assert.equal(m.newCompanies, 1)
  assert.equal(m.won, 1)
  assert.equal(m.lost, 1)
  assert.equal(m.winRate, 0.5)
  assert.equal(m.wonAmount, 5000)
  assert.equal(m.pipelineAmount, 700)
  assert.equal(m.sameDayRate, 2 / 3)
  assert.equal(m.medianResponseHours, 7)
  assert.deepEqual(m.lostReasons, [{ key: 'Precio', count: 1 }])
  assert.equal(m.byChannel.find((c) => c.key === 'whatsapp')?.won, 1)
  assert.equal(weekStart('2026-11-05'), '2026-11-02')
})
