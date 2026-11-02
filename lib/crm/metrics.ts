/** Métricas del CRM para un período. Funciones puras sobre los datos ya cargados. */
import type { CrmChannel, CrmInboundRequest, CrmQuote, CrmServiceType, CrmStage } from './types'

const TZ = 'America/Argentina/Buenos_Aires'

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
}

function inRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!iso) return false
  const d = dayKey(iso)
  return d >= from && d <= to
}

function countBy<T, K extends string>(xs: T[], key: (x: T) => K | null | undefined): { key: K; count: number }[] {
  const m = new Map<K, number>()
  for (const x of xs) {
    const k = key(x)
    if (k == null) continue
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count)
}

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Lunes de la semana (AAAA-MM-DD) para agrupar. */
export function weekStart(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - dow)
  return dt.toISOString().slice(0, 10)
}

export type CrmMetrics = {
  requests: number
  discarded: number
  pending: number
  companies: number
  newCompanies: number
  quotes: number
  won: number
  lost: number
  open: number
  winRate: number | null
  wonAmount: number
  pipelineAmount: number
  medianResponseHours: number | null
  sameDayRate: number | null
  byChannel: { key: CrmChannel; count: number; won: number }[]
  byService: { key: CrmServiceType; count: number }[]
  byDestination: { key: string; count: number }[]
  byStage: { key: CrmStage; count: number }[]
  lostReasons: { key: string; count: number }[]
  topCompanies: { companyId: string; name: string; requests: number; quotes: number; won: number; wonAmount: number }[]
  weekly: { week: string; requests: number; won: number }[]
}

export function computeMetrics(
  data: {
    requests: Pick<CrmInboundRequest, 'id' | 'channel' | 'status' | 'receivedAt' | 'companyId'>[]
    quotes: CrmQuote[]
    companies: { id: string; name: string; createdAt: string }[]
  },
  from: string,
  to: string,
): CrmMetrics {
  const reqs = data.requests.filter((r) => inRange(r.receivedAt, from, to))
  const quotes = data.quotes.filter((q) => inRange(q.receivedAt, from, to))
  const decided = data.quotes.filter((q) => (q.stage === 'ganada' || q.stage === 'perdida') && inRange(q.decidedAt, from, to))
  const won = decided.filter((q) => q.stage === 'ganada')
  const lost = decided.filter((q) => q.stage === 'perdida')
  const open = data.quotes.filter((q) => q.stage !== 'ganada' && q.stage !== 'perdida')

  const companyIds = new Set<string>()
  for (const r of reqs) if (r.companyId) companyIds.add(r.companyId)
  for (const q of quotes) companyIds.add(q.companyId)
  const newCompanies = data.companies.filter((c) => companyIds.has(c.id) && inRange(c.createdAt, from, to)).length

  const responded = data.quotes.filter((q) => q.sentAt && inRange(q.sentAt, from, to))
  const hours = responded.map((q) => (new Date(q.sentAt!).getTime() - new Date(q.receivedAt).getTime()) / 3600000).filter((h) => h >= 0)
  const sameDay = responded.filter((q) => dayKey(q.sentAt!) === dayKey(q.receivedAt)).length

  // Canal: pedidos de la bandeja + cotizaciones cargadas sin pasar por la bandeja
  const channelRows = [
    ...reqs.map((r) => ({ channel: r.channel })),
    ...quotes.filter((q) => !q.inboundRequestId).map((q) => ({ channel: q.channel })),
  ]
  const byChannel = countBy(channelRows, (r) => r.channel).map((c) => ({
    ...c,
    won: won.filter((q) => q.channel === c.key).length,
  }))

  const companyName = new Map(data.companies.map((c) => [c.id, c.name]))
  const top = new Map<string, { companyId: string; name: string; requests: number; quotes: number; won: number; wonAmount: number }>()
  const row = (id: string) => {
    let r = top.get(id)
    if (!r) {
      r = { companyId: id, name: companyName.get(id) ?? '—', requests: 0, quotes: 0, won: 0, wonAmount: 0 }
      top.set(id, r)
    }
    return r
  }
  for (const r of reqs) if (r.companyId) row(r.companyId).requests++
  for (const q of quotes) row(q.companyId).quotes++
  for (const q of won) {
    const r = row(q.companyId)
    r.won++
    r.wonAmount += q.quotedAmount ?? 0
  }

  const weeks = new Map<string, { week: string; requests: number; won: number }>()
  const wk = (iso: string) => {
    const k = weekStart(dayKey(iso))
    let w = weeks.get(k)
    if (!w) { w = { week: k, requests: 0, won: 0 }; weeks.set(k, w) }
    return w
  }
  for (const r of reqs) wk(r.receivedAt).requests++
  for (const q of quotes) if (!q.inboundRequestId) wk(q.receivedAt).requests++
  for (const q of won) wk(q.decidedAt!).won++

  // Semanas sin pedidos también se muestran (eje de tiempo continuo)
  for (let w = weekStart(from); w <= weekStart(to); ) {
    if (!weeks.has(w)) weeks.set(w, { week: w, requests: 0, won: 0 })
    const [y, m, d] = w.split('-').map(Number)
    w = new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10)
  }

  return {
    requests: channelRows.length,
    discarded: reqs.filter((r) => r.status === 'discarded').length,
    pending: data.requests.filter((r) => r.status === 'pending').length,
    companies: companyIds.size,
    newCompanies,
    quotes: quotes.length,
    won: won.length,
    lost: lost.length,
    open: open.length,
    winRate: decided.length ? won.length / decided.length : null,
    wonAmount: won.reduce((s, q) => s + (q.quotedAmount ?? 0), 0),
    pipelineAmount: open.reduce((s, q) => s + (q.quotedAmount ?? q.suggestedAmount ?? 0), 0),
    medianResponseHours: median(hours),
    sameDayRate: responded.length ? sameDay / responded.length : null,
    byChannel,
    byService: countBy(quotes, (q) => q.serviceType),
    byDestination: countBy(quotes, (q) => q.destinationProvince ?? q.destination),
    byStage: countBy(quotes, (q) => q.stage),
    lostReasons: countBy(lost, (q) => q.lostReason ?? 'Sin motivo'),
    topCompanies: [...top.values()].sort((a, b) => b.requests + b.quotes - (a.requests + a.quotes) || b.won - a.won).slice(0, 15),
    weekly: [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)),
  }
}
