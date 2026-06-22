import { NextResponse } from 'next/server'
import { sendDocumentAlerts } from '@/lib/notifications/document-alerts'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const result = await sendDocumentAlerts()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
