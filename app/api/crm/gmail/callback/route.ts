import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/auth/session'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'
import { logAudit } from '@/lib/audit/log'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { accessTokenFrom, encryptToken, exchangeCode, getProfileEmail, GMAIL_SCOPES, publicBaseUrl } from '@/lib/crm/server/gmail'

export const dynamic = 'force-dynamic'

/** Google vuelve acá después de autorizar. Guarda el refresh token cifrado. */
export async function GET(request: NextRequest) {
  const session = await requireSuperadmin()
  const base = publicBaseUrl(request.url)
  const back = (q: string) => NextResponse.redirect(`${base}/app/crm/prospectos?${q}`)
  const url = new URL(request.url)
  const err = url.searchParams.get('error')
  if (err) return back(`gmail=error&msg=${encodeURIComponent(err === 'access_denied' ? 'Se canceló la autorización' : err)}`)
  const state = url.searchParams.get('state')
  if (!state || state !== request.cookies.get('crm_gmail_state')?.value) {
    return back(`gmail=error&msg=${encodeURIComponent('La autorización venció: probá de nuevo')}`)
  }
  try {
    const tok = await exchangeCode(url.searchParams.get('code') ?? '', base)
    if (!tok.refresh_token) throw new Error('Google no devolvió el permiso permanente: quitá el acceso de la app en tu cuenta de Google y volvé a conectar')
    const granted = (tok.scope ?? '').split(' ')
    const missing = GMAIL_SCOPES.filter((s) => !granted.includes(s))
    if (missing.length) throw new Error('Hay que aceptar los dos permisos (enviar y leer mails)')
    const email = await getProfileEmail(tok.access_token ?? (await accessTokenFrom(tok.refresh_token)))
    const db = createServiceRoleClient()
    const { error } = await db.from('crm_gmail_connection').upsert({
      id: 1,
      email,
      refresh_token_enc: encryptToken(tok.refresh_token),
      connected_by: session.user.id,
      connected_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: 'id' })
    if (error) throw new Error(error.message)
    await logAudit({ action: AUDIT_ACTIONS.crmGmailConnect, summary: `Conectó la casilla ${email} para prospección (CRM)` })
    const res = back('gmail=ok')
    res.cookies.set('crm_gmail_state', '', { maxAge: 0, path: '/api/crm/gmail' })
    return res
  } catch (e) {
    return back(`gmail=error&msg=${encodeURIComponent(e instanceof Error ? e.message : 'Error al conectar Gmail')}`)
  }
}
