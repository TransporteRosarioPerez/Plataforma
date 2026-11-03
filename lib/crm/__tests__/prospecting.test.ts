import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  argentinaClock,
  argentinaDayStart,
  buildMime,
  buildTemplateVars,
  classifyReply,
  csvToProspects,
  decodeBase64Url,
  inSendWindow,
  missingVariables,
  nextSendDate,
  parseAddress,
  parseCsv,
  renderTemplate,
  replySubject,
  routeForProvince,
  routeFromText,
  stripQuotedReply,
  type OutreachRoute,
} from '../prospecting'

const ROUTES: OutreachRoute[] = [
  { key: 'alto_valle', label: 'Alto Valle (Río Negro y Neuquén)', provinces: ['Río Negro', 'Neuquén'], returnDay: 'los jueves', position: 1 },
  { key: 'noa', label: 'Tucumán y NOA', provinces: ['Tucumán', 'Salta', 'Jujuy'], returnDay: null, position: 2 },
  { key: 'litoral', label: 'Litoral', provinces: ['Entre Ríos', 'Corrientes'], returnDay: null, position: 3 },
]

const P = { companyName: 'Kleppe S.A.', contactName: 'Juan Pablo Cerezuela', province: 'Río Negro', city: 'Cipolletti', products: 'Peras y manzanas', hook: null }

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

test('buildTemplateVars arma saludo con el primer nombre y productos en minúscula', () => {
  const v = buildTemplateVars(P, ROUTES[0], 'Rosario')
  assert.equal(v.saludo, 'Hola Juan:')
  assert.equal(v.productos, 'peras y manzanas')
  assert.equal(v.localidad, 'Cipolletti')
  assert.equal(v.dia_vuelta, 'los jueves')
  const sinContacto = buildTemplateVars({ ...P, contactName: null, products: null, city: null }, null, 'R')
  assert.equal(sinContacto.saludo, 'Hola, buenos días:')
  assert.equal(sinContacto.productos, 'su mercadería')
  assert.equal(sinContacto.localidad, 'Río Negro')
  assert.equal(sinContacto.dia_vuelta, '')
})

test('renderTemplate reemplaza variables y omite [[ ]] con variables vacías', () => {
  const tpl = '{saludo}\n\n[[{gancho}\n\n]]Llevamos carga a {provincia}[[, volvemos {dia_vuelta}]].\n\n{firma}'
  const conDia = renderTemplate(tpl, buildTemplateVars(P, ROUTES[0], 'Rosario Perez'))
  assert.equal(conDia, 'Hola Juan:\n\nLlevamos carga a Río Negro, volvemos los jueves.\n\nRosario Perez')
  const conGancho = renderTemplate(tpl, buildTemplateVars({ ...P, hook: 'Vi que venden en el Central.' }, ROUTES[1], 'R'))
  assert.equal(conGancho, 'Hola Juan:\n\nVi que venden en el Central.\n\nLlevamos carga a Río Negro.\n\nR')
})

test('renderTemplate deja visibles las variables desconocidas y missingVariables las detecta', () => {
  const vars = buildTemplateVars(P, null, 'R')
  assert.equal(renderTemplate('Hola {empresa} {otra}', vars), 'Hola Kleppe S.A. {otra}')
  assert.deepEqual(missingVariables('Hola {empresa} {otra} [[{dia_vuelta}]]', vars), ['otra'])
})

test('replySubject agrega Re: una sola vez', () => {
  assert.equal(replySubject('Vuelta refrigerada'), 'Re: Vuelta refrigerada')
  assert.equal(replySubject('RE: Vuelta'), 'RE: Vuelta')
})

// ---------------------------------------------------------------------------
// Rutas y CSV
// ---------------------------------------------------------------------------

test('routeForProvince / routeFromText sin importar acentos', () => {
  assert.equal(routeForProvince('Rio Negro', ROUTES), 'alto_valle')
  assert.equal(routeForProvince('TUCUMAN', ROUTES), 'noa')
  assert.equal(routeForProvince('Mendoza', ROUTES), null)
  assert.equal(routeFromText('Alto Valle', ROUTES), 'alto_valle')
  assert.equal(routeFromText('Carga de retorno – Tucumán', ROUTES), 'noa')
  assert.equal(routeFromText('litoral', ROUTES), 'litoral')
})

test('parseCsv maneja comillas, comas internas y ;', () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","di ""hola"""\n'), [['a', 'b'], ['x, y', 'di "hola"']])
  assert.deepEqual(parseCsv('a;b\r\n1;2'), [['a', 'b'], ['1', '2']])
  assert.deepEqual(parseCsv('a,b\n"multi\nlínea",2'), [['a', 'b'], ['multi\nlínea', '2']])
})

test('csvToProspects reconoce encabezados en español e inglés', () => {
  const es = csvToProspects('Empresa,Mail contacto,Contacto,Provincia,Prioridad,Teléfono\nKleppe S.A.,JPCerezuela@kleppe.com.ar,Juan Pablo,Río Negro,Alta,299 580\nSin Mail SRL,,,Tucumán,,\n,x@y.com,,,,')
  assert.equal(es.rows.length, 2)
  assert.equal(es.rows[0].email, 'jpcerezuela@kleppe.com.ar')
  assert.equal(es.rows[0].priority, 'alta')
  assert.equal(es.rows[0].phone, '299 580')
  assert.equal(es.rows[1].email, null)
  assert.equal(es.rows[1].priority, 'media')
  assert.equal(es.errors.length, 1)
  const en = csvToProspects('name,email,contact_name,province,city,segment,priority,notes\nTres Ases S.A.,daburto@tresases.com.ar,Daniela,Río Negro,Cipolletti,Carga de retorno – Alto Valle,Alta,ok')
  assert.equal(en.rows[0].companyName, 'Tres Ases S.A.')
  assert.equal(en.rows[0].route, 'Carga de retorno – Alto Valle')
  assert.deepEqual(csvToProspects('mail\nx@y.com').errors, ['Falta la columna "empresa"'])
})

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------

test('stripQuotedReply corta la parte citada', () => {
  const t = 'Hola, sí, nos interesa. Son 10 pallets.\n\nEl mar, 4 nov 2026 a las 10:00, Rosario <r@x.com> escribió:\n> Hola Juan:\n> Somos...'
  assert.equal(stripQuotedReply(t), 'Hola, sí, nos interesa. Son 10 pallets.')
  assert.equal(stripQuotedReply('ok\n\nOn Tue, Nov 4, 2026 at 10:00 AM Rosario wrote:\n> x'), 'ok')
})

test('classifyReply distingue rebote, automática, "no" y respuesta real', () => {
  assert.equal(classifyReply({ fromEmail: 'mailer-daemon@googlemail.com', subject: 'Delivery Status Notification (Failure)', body: '' }), 'bounce')
  assert.equal(classifyReply({ fromEmail: 'a@b.com', subject: 'Respuesta automática: Vuelta', body: 'Estoy de vacaciones' }), 'auto')
  assert.equal(classifyReply({ fromEmail: 'a@b.com', subject: 'Re: x', body: 'hola', headers: { 'Auto-Submitted': 'auto-replied' } }), 'auto')
  assert.equal(classifyReply({ fromEmail: 'a@b.com', subject: 'Re: x', body: 'No\n\nEl lun escribió:\n> ...' }), 'negative')
  assert.equal(classifyReply({ fromEmail: 'a@b.com', subject: 'Re: x', body: 'No gracias, saludos' }), 'negative')
  assert.equal(classifyReply({ fromEmail: 'a@b.com', subject: 'Re: x', body: 'Por favor dar de baja este mail.' }), 'negative')
  assert.equal(classifyReply({ fromEmail: 'a@b.com', subject: 'Re: x', body: 'No tenemos carga esta semana pero la próxima sí, ¿cuánto sale 8 pallets a Buenos Aires?' }), 'reply')
  assert.equal(classifyReply({ fromEmail: 'a@b.com', subject: 'Re: x', body: 'Sí, pasame precio Cipolletti - Mercado Central, 20 pallets' }), 'reply')
})

test('parseAddress', () => {
  assert.deepEqual(parseAddress('"Juan Pérez" <Juan@Kleppe.com.ar>'), { name: 'Juan Pérez', email: 'juan@kleppe.com.ar' })
  assert.deepEqual(parseAddress('juan@x.com'), { name: null, email: 'juan@x.com' })
})

// ---------------------------------------------------------------------------
// MIME
// ---------------------------------------------------------------------------

test('buildMime arma headers de hilo, baja one-click y cuerpo UTF-8', () => {
  const mime = buildMime({
    fromEmail: 'ventas@trp.com.ar', fromName: 'Rosario Pérez', to: 'a@b.com', subject: 'Vuelta Río Negro → Buenos Aires',
    body: 'Hola Juan:\nñandú', inReplyTo: '<m2@x>', references: '<m1@x>', unsubscribeUrl: 'https://p.com/api/crm/unsubscribe?t=1',
  })
  const [head, body] = mime.split('\r\n\r\n')
  assert.match(head, /^From: =\?UTF-8\?B\?.+\?= <ventas@trp\.com\.ar>/)
  assert.match(head, /Subject: =\?UTF-8\?B\?/)
  assert.match(head, /In-Reply-To: <m2@x>/)
  assert.match(head, /References: <m1@x> <m2@x>/)
  assert.match(head, /List-Unsubscribe: <https:\/\/p\.com\/api\/crm\/unsubscribe\?t=1>, <mailto:ventas@trp\.com\.ar\?subject=baja>/)
  assert.match(head, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/)
  assert.equal(Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8'), 'Hola Juan:\r\nñandú')
  assert.equal(decodeBase64Url(Buffer.from('ñ').toString('base64url')), 'ñ')
})

// ---------------------------------------------------------------------------
// Horarios
// ---------------------------------------------------------------------------

test('horarios en Argentina: ventana de envío, comienzo del día y próximo envío hábil', () => {
  const martes10 = new Date('2026-11-03T13:00:00Z') // 10:00 ART, martes
  assert.deepEqual(argentinaClock(martes10), { hour: 10, weekday: 2, date: '2026-11-03' })
  assert.equal(argentinaDayStart(new Date('2026-11-04T02:00:00Z')).toISOString(), '2026-11-03T03:00:00.000Z')
  const cfg = { sendHourFrom: 9, sendHourTo: 18, weekdaysOnly: true }
  assert.equal(inSendWindow(martes10, cfg), true)
  assert.equal(inSendWindow(new Date('2026-11-03T22:00:00Z'), cfg), false) // 19 h
  assert.equal(inSendWindow(new Date('2026-11-07T13:00:00Z'), cfg), false) // sábado
  // Martes + 4 días = sábado → pasa al lunes a las 10 h
  assert.equal(nextSendDate(martes10, 4).toISOString(), '2026-11-09T13:00:00.000Z')
  assert.equal(nextSendDate(martes10, 1).toISOString(), '2026-11-04T13:00:00.000Z')
})

test('productos sin paréntesis', () => {
  assert.equal(buildTemplateVars({ ...P, products: 'Peras, manzanas, cerezas (marca Gaucho)' }, null, 'R').productos, 'peras, manzanas, cerezas')
})
