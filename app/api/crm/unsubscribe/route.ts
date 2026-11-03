/**
 * Baja de la prospección. Público (sin login).
 * - GET: página con botón de confirmación (los antivirus de mail abren los links solos).
 * - POST: baja. Lo usa el botón de la página y el "Desuscribir" de Gmail (RFC 8058, one-click).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic = 'force-dynamic'

const page = (title: string, body: string) =>
  new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#1f2937}h1{font-size:20px}button{font:inherit;padding:10px 18px;border-radius:8px;border:0;background:#1f4e78;color:#fff;cursor:pointer}</style>
</head><body><h1>${title}</h1>${body}<p style="color:#6b7280;font-size:13px;margin-top:32px">Transporte Rosario Perez · San Pedro, Buenos Aires</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )

const tokenSchema = z.string().uuid()

export async function GET(request: NextRequest) {
  const t = new URL(request.url).searchParams.get('t') ?? ''
  if (!tokenSchema.safeParse(t).success) return page('Link inválido', '<p>El link de baja no es válido.</p>')
  return page(
    '¿Dejar de recibir nuestros mails?',
    `<p>No te vamos a volver a escribir sobre cargas de vuelta.</p><form method="post"><input type="hidden" name="t" value="${t}"><button type="submit">Confirmar baja</button></form>`,
  )
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  let t = url.searchParams.get('t') ?? ''
  if (!t) {
    const form = await request.formData().catch(() => null)
    t = String(form?.get('t') ?? '')
  }
  if (!tokenSchema.safeParse(t).success) return page('Link inválido', '<p>El link de baja no es válido.</p>')
  const db = createServiceRoleClient()
  const { data: o } = await db.from('crm_outreach').select('id, prospect_id, to_email').eq('unsubscribe_token', t).maybeSingle()
  if (o) {
    await db.from('crm_email_suppressions').upsert({ email: o.to_email.toLowerCase(), reason: 'baja', source: `outreach:${o.id}` }, { onConflict: 'email' })
    await db.from('crm_outreach').update({ status: 'baja', next_send_at: null }).eq('id', o.id)
    await db.from('crm_outreach').update({ status: 'baja', next_send_at: null }).eq('to_email', o.to_email).in('status', ['activa', 'pausada'])
    await db.from('crm_prospects').update({ status: 'baja' }).eq('id', o.prospect_id).in('status', ['nuevo', 'en_secuencia', 'sin_respuesta'])
  }
  return page('Listo, te dimos de baja', '<p>No vas a recibir más mails nuestros. Disculpá la molestia.</p>')
}
