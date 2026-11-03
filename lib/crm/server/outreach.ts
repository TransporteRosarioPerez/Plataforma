import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { buildInboundRow } from '../inbound'
import {
  argentinaDayStart,
  buildMime,
  buildTemplateVars,
  classifyReply,
  inSendWindow,
  nextSendDate,
  parseAddress,
  renderTemplate,
  replySubject,
  stripQuotedReply,
  type ProspectStatus,
} from '../prospecting'
import {
  accessTokenFrom,
  decryptToken,
  findBounceFor,
  getRfcMessageId,
  getThread,
  GmailError,
  publicBaseUrl,
  sendRaw,
} from './gmail'

/**
 * Job de prospección: 1) lee respuestas de los hilos (respuesta → pedido en la
 * Bandeja; "no" → baja; rebote → rebotado) y 2) envía los mails que tocan hoy,
 * respetando el tope diario y el horario. Lo llaman el cron y "Sincronizar ahora".
 */

type Db = ReturnType<typeof createServiceRoleClient>

export type OutreachRunSummary = {
  ok: boolean
  reason?: string
  sent: number
  failed: number
  replies: number
  negatives: number
  bounces: number
  checked: number
  outsideWindow: boolean
  remainingToday: number
}

const MAX_THREADS_PER_RUN = 40
// Estados del prospecto que el job puede pisar (no toca cotizando/ganado/perdido)
const AUTO_STATUSES: ProspectStatus[] = ['nuevo', 'en_secuencia', 'sin_respuesta']

type Conn = {
  email: string
  refresh_token_enc: string
  sender_name: string
  signature: string
  daily_limit: number
  send_hour_from: number
  send_hour_to: number
  weekdays_only: boolean
}

async function suppress(db: Db, email: string, reason: 'baja' | 'rebote' | 'respondio_no' | 'manual', source: string) {
  await db.from('crm_email_suppressions').upsert({ email: email.toLowerCase(), reason, source }, { onConflict: 'email' })
}

async function setProspectStatus(db: Db, prospectId: string, status: ProspectStatus, extra: Record<string, unknown> = {}) {
  await db.from('crm_prospects').update({ status, ...extra }).eq('id', prospectId).in('status', AUTO_STATUSES)
}

// ---------------------------------------------------------------------------
// 1) Respuestas
// ---------------------------------------------------------------------------

async function checkReplies(db: Db, token: string, myEmail: string, now: Date, s: OutreachRunSummary) {
  const since = new Date(now.getTime() - 60 * 86_400_000).toISOString()
  const { data, error } = await db
    .from('crm_outreach')
    .select('id, prospect_id, status, to_email, subject, gmail_thread_id, created_at, updated_at, prospect:crm_prospects(id, company_name, contact_name, phone, status)')
    .is('replied_at', null)
    .not('gmail_thread_id', 'is', null)
    .in('status', ['activa', 'pausada', 'terminada'])
    .gte('created_at', since)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(MAX_THREADS_PER_RUN)
  if (error) throw new Error(error.message)

  for (const o of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prospect = (Array.isArray(o.prospect) ? o.prospect[0] : o.prospect) as any
    s.checked++
    let handled = false
    let messages: Awaited<ReturnType<typeof getThread>>
    try {
      messages = await getThread(token, o.gmail_thread_id as string)
    } catch (e) {
      if (e instanceof GmailError && (e.status === 401 || e.status === 403)) throw e
      // Hilo borrado o error puntual: se reintenta en la próxima corrida
      await db.from('crm_outreach').update({ last_checked_at: now.toISOString() }).eq('id', o.id)
      continue
    }
    for (const m of messages) {
      if (m.sentByMe) continue
      const from = parseAddress(m.from)
      if (from.email === myEmail) continue
      const kind = classifyReply({ fromEmail: from.email, subject: m.subject, body: m.text, headers: m.headers })
      if (kind === 'auto') continue
      if (kind === 'bounce') {
        await db.from('crm_outreach').update({ status: 'rebotada', next_send_at: null, last_checked_at: now.toISOString() }).eq('id', o.id)
        await setProspectStatus(db, o.prospect_id, 'rebotado')
        await suppress(db, o.to_email, 'rebote', `outreach:${o.id}`)
        s.bounces++
      } else if (kind === 'negative') {
        await db.from('crm_outreach').update({ status: 'baja', next_send_at: null, replied_at: m.date.toISOString(), last_checked_at: now.toISOString() }).eq('id', o.id)
        await setProspectStatus(db, o.prospect_id, 'baja', { replied_at: m.date.toISOString() })
        await suppress(db, o.to_email, 'respondio_no', `outreach:${o.id}`)
        s.negatives++
      } else {
        const row = buildInboundRow({
          channel: 'email',
          receivedAt: m.date.toISOString(),
          name: from.name ?? prospect?.contact_name ?? null,
          company: prospect?.company_name ?? null,
          email: from.email,
          phone: prospect?.phone ?? null,
          subject: m.subject,
          message: stripQuotedReply(m.text) || m.text.slice(0, 2000),
          externalId: `gmail:${m.id}`,
          meta: { source: 'prospeccion', prospectId: o.prospect_id, outreachId: o.id, gmailThreadId: o.gmail_thread_id },
        })
        const ins = await db.from('crm_inbound_requests').insert(row).select('id').single()
        let inboundId = ins.data?.id as string | undefined
        if (ins.error && !ins.error.message.includes('duplicate')) throw new Error(ins.error.message)
        if (!inboundId) {
          const ex = await db.from('crm_inbound_requests').select('id').eq('channel', 'email').eq('external_id', `gmail:${m.id}`).maybeSingle()
          inboundId = ex.data?.id
        }
        await db.from('crm_outreach').update({
          status: 'respondida', next_send_at: null, replied_at: m.date.toISOString(),
          inbound_request_id: inboundId ?? null, last_checked_at: now.toISOString(),
        }).eq('id', o.id)
        await setProspectStatus(db, o.prospect_id, 'respondio', { replied_at: m.date.toISOString() })
        s.replies++
      }
      handled = true
      break
    }
    if (handled) continue

    const ageDays = (now.getTime() - new Date(o.created_at).getTime()) / 86_400_000
    if (ageDays < 7 && (await findBounceFor(token, o.to_email, new Date(o.created_at)).catch(() => false))) {
      await db.from('crm_outreach').update({ status: 'rebotada', next_send_at: null, last_checked_at: now.toISOString() }).eq('id', o.id)
      await setProspectStatus(db, o.prospect_id, 'rebotado')
      await suppress(db, o.to_email, 'rebote', `outreach:${o.id}`)
      s.bounces++
      continue
    }
    // Secuencia terminada hace más de 7 días sin respuesta
    const idleDays = (now.getTime() - new Date(o.updated_at).getTime()) / 86_400_000
    if (o.status === 'terminada' && idleDays > 7) await setProspectStatus(db, o.prospect_id, 'sin_respuesta')
    await db.from('crm_outreach').update({ last_checked_at: now.toISOString() }).eq('id', o.id)
  }
}

// ---------------------------------------------------------------------------
// 2) Envíos
// ---------------------------------------------------------------------------

async function sendDue(db: Db, token: string, conn: Conn, baseUrl: string, now: Date, s: OutreachRunSummary) {
  const { count } = await db
    .from('crm_outreach_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', argentinaDayStart(now).toISOString())
  let remaining = Math.max(0, conn.daily_limit - (count ?? 0))
  s.remainingToday = remaining
  if (remaining === 0) return

  const { data: due, error } = await db
    .from('crm_outreach')
    .select('*, prospect:crm_prospects(id, company_name, contact_name, province, city, products, hook, status, deleted_at, route:crm_outreach_routes(return_day))')
    .eq('status', 'activa')
    .lte('next_send_at', now.toISOString())
    .order('next_send_at', { ascending: true })
    .limit(remaining)
  if (error) throw new Error(error.message)
  if (!due?.length) return

  const { data: tpls } = await db.from('crm_outreach_templates').select('*').eq('is_active', true).order('step')
  const { data: supp } = await db.from('crm_email_suppressions').select('email').in('email', due.map((o) => o.to_email.toLowerCase()))
  const suppressed = new Set((supp ?? []).map((x) => x.email))

  for (const o of due) {
    if (remaining <= 0) break
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (Array.isArray(o.prospect) ? o.prospect[0] : o.prospect) as any
    if (!p || p.deleted_at) {
      await db.from('crm_outreach').update({ status: 'cancelada', next_send_at: null }).eq('id', o.id)
      continue
    }
    if (suppressed.has(o.to_email.toLowerCase())) {
      await db.from('crm_outreach').update({ status: 'baja', next_send_at: null }).eq('id', o.id)
      await setProspectStatus(db, p.id, 'baja')
      continue
    }
    const seq = (tpls ?? []).filter((t) => t.sequence === o.sequence)
    // Si un seguimiento está desactivado, se pasa al siguiente activo
    const tpl = seq.find((t) => t.step >= o.next_step)
    if (!tpl) {
      await db.from('crm_outreach').update({ status: 'terminada', next_send_at: null }).eq('id', o.id)
      continue
    }
    const next = seq.find((t) => t.step > tpl.step)
    const route = Array.isArray(p.route) ? p.route[0] : p.route
    const vars = buildTemplateVars(
      { companyName: p.company_name, contactName: p.contact_name, province: p.province, city: p.city, products: p.products, hook: p.hook },
      route ? { returnDay: route.return_day } : null,
      conn.signature,
    )
    const firstSubject = o.subject || renderTemplate(seq.find((t) => t.step === 1)?.subject || tpl.subject || 'Carga de vuelta a Buenos Aires', vars)
    const subject = o.gmail_thread_id ? replySubject(firstSubject) : firstSubject
    const body = renderTemplate(tpl.body, vars)
    const mime = buildMime({
      fromEmail: conn.email,
      fromName: conn.sender_name,
      to: o.to_email,
      subject,
      body,
      inReplyTo: o.last_rfc_message_id,
      references: o.rfc_references,
      unsubscribeUrl: `${baseUrl}/api/crm/unsubscribe?t=${o.unsubscribe_token}`,
    })

    try {
      const sent = await sendRaw(token, mime, o.gmail_thread_id)
      const rfc = await getRfcMessageId(token, sent.id).catch(() => null)
      await db.from('crm_outreach_messages').insert({
        outreach_id: o.id, step: tpl.step, to_email: o.to_email, subject, body, status: 'sent',
        gmail_message_id: sent.id, rfc_message_id: rfc,
      })
      await db.from('crm_outreach').update({
        gmail_thread_id: sent.threadId,
        subject: firstSubject,
        last_rfc_message_id: rfc ?? o.last_rfc_message_id,
        rfc_references: [o.rfc_references, o.last_rfc_message_id].filter(Boolean).join(' ') || null,
        next_step: tpl.step + 1,
        next_send_at: next ? nextSendDate(now, next.delay_days - tpl.delay_days).toISOString() : null,
        status: next ? 'activa' : 'terminada',
        send_attempts: 0,
        error: null,
      }).eq('id', o.id)
      await db.from('crm_prospects').update({ last_contacted_at: now.toISOString() }).eq('id', p.id)
      await setProspectStatus(db, p.id, 'en_secuencia')
      s.sent++
      remaining--
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al enviar'
      const status = e instanceof GmailError ? e.status : 0
      await db.from('crm_outreach_messages').insert({ outreach_id: o.id, step: tpl.step, to_email: o.to_email, subject, body, status: 'failed', error: msg })
      s.failed++
      if (status === 401 || status === 403) throw e // problema con la casilla: cortar todo
      const attempts = (o.send_attempts ?? 0) + 1
      const giveUp = status === 400 || attempts >= 3
      await db.from('crm_outreach').update({
        send_attempts: attempts,
        error: msg,
        status: giveUp ? 'error' : 'activa',
        next_send_at: giveUp ? null : new Date(now.getTime() + 60 * 60_000).toISOString(),
      }).eq('id', o.id)
    }
  }
  s.remainingToday = remaining
}

// ---------------------------------------------------------------------------

export async function runOutreach(opts: { requestUrl?: string; now?: Date; sendOutsideWindow?: boolean } = {}): Promise<OutreachRunSummary> {
  const now = opts.now ?? new Date()
  const s: OutreachRunSummary = { ok: true, sent: 0, failed: 0, replies: 0, negatives: 0, bounces: 0, checked: 0, outsideWindow: false, remainingToday: 0 }
  const db = createServiceRoleClient()
  const { data: conn } = await db.from('crm_gmail_connection').select('*').eq('id', 1).maybeSingle()
  if (!conn) return { ...s, ok: false, reason: 'Gmail no está conectado' }

  try {
    const token = await accessTokenFrom(decryptToken(conn.refresh_token_enc))
    await checkReplies(db, token, conn.email.toLowerCase(), now, s)
    const cfg = { sendHourFrom: conn.send_hour_from, sendHourTo: conn.send_hour_to, weekdaysOnly: conn.weekdays_only }
    if (opts.sendOutsideWindow || inSendWindow(now, cfg)) {
      await sendDue(db, token, conn as Conn, publicBaseUrl(opts.requestUrl), now, s)
    } else {
      s.outsideWindow = true
    }
    await db.from('crm_gmail_connection').update({ last_sync_at: now.toISOString(), last_error: null }).eq('id', 1)
    return s
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'Error en la prospección'
    await db.from('crm_gmail_connection').update({ last_sync_at: now.toISOString(), last_error: reason }).eq('id', 1)
    return { ...s, ok: false, reason }
  }
}
