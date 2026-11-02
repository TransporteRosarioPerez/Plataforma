/**
 * Entrada pública de pedidos de cotización → Bandeja del CRM.
 *
 * 1) Formulario de la landing (navegador): POST JSON desde un origen permitido
 *    (CRM_ALLOWED_ORIGINS). Canal forzado a "landing". Honeypot `website` y límite por IP.
 * 2) Integraciones servidor a servidor (Make/Zapier/webhook de mail o WhatsApp):
 *    header `Authorization: Bearer <CRM_INBOUND_SECRET>`; pueden indicar `channel`
 *    y `externalId` (evita duplicados si el webhook reintenta).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { buildInboundRow } from '@/lib/crm/inbound'

export const dynamic = 'force-dynamic'

const schema = z.object({
  channel: z.enum(['whatsapp', 'email', 'landing', 'phone', 'other']).optional(),
  name: z.string().max(120).optional().nullable(),
  company: z.string().max(160).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  cuit: z.string().max(20).optional().nullable(),
  subject: z.string().max(200).optional().nullable(),
  message: z.string().max(8000).optional().nullable(),
  origin: z.string().max(120).optional().nullable(),
  destination: z.string().max(120).optional().nullable(),
  serviceType: z.enum(['congelado', 'refrigerado', 'controlada', 'seco']).optional().nullable(),
  loadType: z.enum(['completa', 'parcial']).optional().nullable(),
  pallets: z.coerce.number().int().positive().max(500).optional().nullable(),
  weightKg: z.coerce.number().positive().optional().nullable(),
  loadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  frequency: z.enum(['unica', 'semanal', 'quincenal', 'mensual']).optional().nullable(),
  receivedAt: z.string().datetime().optional().nullable(),
  externalId: z.string().max(200).optional().nullable(),
  website: z.string().optional().nullable(), // honeypot: los humanos lo dejan vacío
  utm: z.record(z.string().max(200)).optional(),
})

function allowedOrigins(): string[] {
  return (process.env.CRM_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins()
  const ok = origin && (allowed.includes(origin) || allowed.includes('*'))
  return {
    ...(ok ? { 'Access-Control-Allow-Origin': origin! } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

// Límite simple por IP (por instancia; alcanza contra abusos básicos del form)
const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > 8
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)
  const secret = process.env.CRM_INBOUND_SECRET
  const auth = req.headers.get('authorization')
  const trusted = !!secret && auth === `Bearer ${secret}`

  if (!trusted) {
    const allowed = allowedOrigins()
    if (!origin || !(allowed.includes(origin) || allowed.includes('*'))) {
      return NextResponse.json({ ok: false, error: 'origin_not_allowed' }, { status: 403, headers })
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (rateLimited(ip)) return NextResponse.json({ ok: false, error: 'too_many_requests' }, { status: 429, headers })
  }

  let body: unknown
  try {
    const type = req.headers.get('content-type') ?? ''
    body = type.includes('application/json')
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries())
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400, headers })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_fields', details: parsed.error.flatten().fieldErrors }, { status: 400, headers })
  }
  const d = parsed.data
  // Bot: responder OK sin guardar
  if (d.website) return NextResponse.json({ ok: true }, { headers })
  if (!d.message?.trim() && !d.company && !d.email && !d.phone) {
    return NextResponse.json({ ok: false, error: 'empty' }, { status: 400, headers })
  }

  const row = buildInboundRow({
    ...d,
    channel: trusted ? d.channel ?? 'other' : 'landing',
    receivedAt: d.receivedAt ?? undefined,
    externalId: trusted ? d.externalId : null,
    meta: {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      referer: req.headers.get('referer')?.slice(0, 300) ?? null,
      utm: d.utm ?? null,
      source: trusted ? 'api' : 'landing',
    },
  })

  try {
    const supabase = createServiceRoleClient()
    // Mismo mail/teléfono con el mismo mensaje en los últimos 10 minutos: doble envío del form
    if (!trusted && (row.sender_email || row.sender_phone) && row.message) {
      const since = new Date(Date.now() - 10 * 60_000).toISOString()
      let q = supabase.from('crm_inbound_requests').select('id').gte('received_at', since).eq('message', row.message).limit(1)
      q = row.sender_email ? q.eq('sender_email', row.sender_email) : q.eq('sender_phone', row.sender_phone!)
      const { data: dup } = await q
      if (dup?.length) return NextResponse.json({ ok: true, id: dup[0].id, duplicate: true }, { headers })
    }
    const { data, error } = await supabase.from('crm_inbound_requests').insert(row).select('id').single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ ok: true, duplicate: true }, { headers })
      console.error('[crm/inbound]', error.message)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500, headers })
    }
    return NextResponse.json({ ok: true, id: data.id }, { status: 201, headers })
  } catch (e) {
    console.error('[crm/inbound]', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500, headers })
  }
}
