import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { decodeBase64Url, base64Url } from '../prospecting'

/**
 * Gmail por API REST (sin SDK). La casilla se conecta una vez con OAuth
 * (botón "Conectar Gmail"); se guarda sólo el refresh token, cifrado.
 *
 * Variables: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, CRM_GMAIL_TOKEN_KEY,
 * CRM_PUBLIC_URL (opcional; si no, se usa el dominio del request).
 */

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
]

const API = 'https://gmail.googleapis.com/gmail/v1/users/me'

export function gmailConfigured(): { ok: boolean; missing: string[] } {
  const missing = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'CRM_GMAIL_TOKEN_KEY'].filter((k) => !process.env[k])
  return { ok: missing.length === 0, missing }
}

export function publicBaseUrl(requestUrl?: string): string {
  const env = process.env.CRM_PUBLIC_URL?.trim().replace(/\/+$/, '')
  if (env) return env
  if (requestUrl) return new URL(requestUrl).origin
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return 'http://localhost:3000'
}

export function redirectUri(base: string): string {
  return `${base}/api/crm/gmail/callback`
}

// ---------------------------------------------------------------------------
// Cifrado del refresh token (AES-256-GCM)
// ---------------------------------------------------------------------------

function key(): Buffer {
  const raw = process.env.CRM_GMAIL_TOKEN_KEY
  if (!raw) throw new Error('Falta CRM_GMAIL_TOKEN_KEY')
  return createHash('sha256').update(raw).digest()
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':')
}

export function decryptToken(blob: string): string {
  const [v, iv, tag, data] = blob.split(':')
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Token de Gmail inválido: volvé a conectar la casilla')
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8')
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export function authUrl(base: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    redirect_uri: redirectUri(base),
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

async function tokenRequest(body: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; scope?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      ...body,
    }),
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const reason = json.error === 'invalid_grant' ? 'Google revocó el acceso: volvé a conectar Gmail' : (json.error_description || json.error || `HTTP ${res.status}`)
    throw new Error(`Gmail: ${reason}`)
  }
  return json
}

export function exchangeCode(code: string, base: string) {
  return tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri(base) })
}

export async function accessTokenFrom(refreshToken: string): Promise<string> {
  return (await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' })).access_token
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export class GmailError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new GmailError(`Gmail ${res.status}: ${json?.error?.message ?? res.statusText}`, res.status)
  return json as T
}

export async function getProfileEmail(token: string): Promise<string> {
  return (await api<{ emailAddress: string }>(token, '/profile')).emailAddress.toLowerCase()
}

export async function sendRaw(token: string, mime: string, threadId?: string | null): Promise<{ id: string; threadId: string }> {
  return api(token, '/messages/send', { method: 'POST', body: JSON.stringify({ raw: base64Url(mime), ...(threadId ? { threadId } : {}) }) })
}

type Header = { name: string; value: string }
type Part = { mimeType?: string; headers?: Header[]; body?: { data?: string }; parts?: Part[] }
type GmailMessage = { id: string; threadId: string; internalDate: string; labelIds?: string[]; payload: Part }

export async function getRfcMessageId(token: string, id: string): Promise<string | null> {
  const m = await api<GmailMessage>(token, `/messages/${id}?format=metadata&metadataHeaders=Message-ID`)
  return m.payload.headers?.find((h) => h.name.toLowerCase() === 'message-id')?.value ?? null
}

export type ThreadMessage = {
  id: string
  date: Date
  from: string
  subject: string
  headers: Record<string, string>
  text: string
  sentByMe: boolean
}

function textOf(part: Part): string {
  if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64Url(part.body.data)
  for (const p of part.parts ?? []) {
    const t = textOf(p)
    if (t) return t
  }
  if (part.mimeType === 'text/html' && part.body?.data) {
    return decodeBase64Url(part.body.data)
      .replace(/<(br|\/p|\/div)[^>]*>/gi, '\n')
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  }
  return ''
}

export async function getThread(token: string, threadId: string): Promise<ThreadMessage[]> {
  const t = await api<{ messages?: GmailMessage[] }>(token, `/threads/${threadId}?format=full`)
  return (t.messages ?? []).map((m) => {
    const headers = Object.fromEntries((m.payload.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]))
    return {
      id: m.id,
      date: new Date(Number(m.internalDate)),
      from: headers.from ?? '',
      subject: headers.subject ?? '',
      headers,
      text: textOf(m.payload),
      sentByMe: (m.labelIds ?? []).includes('SENT'),
    }
  })
}

/** Rebotes que Gmail no pone en el hilo: busca avisos de mailer-daemon que mencionen la dirección. */
export async function findBounceFor(token: string, email: string, after: Date): Promise<boolean> {
  const q = `from:(mailer-daemon OR postmaster) "${email}" after:${Math.floor(after.getTime() / 1000)}`
  const r = await api<{ resultSizeEstimate?: number; messages?: unknown[] }>(token, `/messages?maxResults=1&q=${encodeURIComponent(q)}`)
  return (r.messages?.length ?? 0) > 0
}
