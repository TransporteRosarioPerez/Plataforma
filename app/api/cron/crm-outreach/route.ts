import { NextResponse } from 'next/server'
import { runOutreach } from '@/lib/crm/server/outreach'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Job de prospección (Vercel Cron): lee respuestas y envía los mails del día. */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const summary = await runOutreach({ requestUrl: request.url })
  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 })
}

export async function POST(request: Request) {
  return GET(request)
}
