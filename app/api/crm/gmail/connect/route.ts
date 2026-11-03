import { randomBytes } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { authUrl, gmailConfigured, publicBaseUrl } from '@/lib/crm/server/gmail'

export const dynamic = 'force-dynamic'

/** Botón "Conectar Gmail": manda a Google a autorizar la casilla. */
export async function GET(request: NextRequest) {
  await requireSuperadmin()
  const base = publicBaseUrl(request.url)
  const cfg = gmailConfigured()
  if (!cfg.ok) {
    return NextResponse.redirect(`${base}/app/crm/prospectos?gmail=error&msg=${encodeURIComponent(`Faltan variables: ${cfg.missing.join(', ')}`)}`)
  }
  const state = randomBytes(16).toString('hex')
  const res = NextResponse.redirect(authUrl(base, state))
  res.cookies.set('crm_gmail_state', state, { httpOnly: true, secure: base.startsWith('https'), sameSite: 'lax', maxAge: 600, path: '/api/crm/gmail' })
  return res
}
