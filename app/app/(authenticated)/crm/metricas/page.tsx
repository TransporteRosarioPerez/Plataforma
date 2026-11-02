import { computeMetrics } from '@/lib/crm/metrics'
import { getMetricsData } from '@/lib/crm/server/data'
import { MetricsView } from '@/components/crm/metrics-view'
import { METRIC_PERIODS as PERIODS } from '@/lib/crm/constants'

function isoDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

export default async function CrmMetricasPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias } = await searchParams
  const period = PERIODS.some((p) => p.value === dias) ? dias! : '90'
  const to = isoDay(new Date())
  const from = isoDay(new Date(Date.now() - (Number(period) - 1) * 86400000))
  const data = await getMetricsData()
  const m = computeMetrics(data, from, to)
  return <MetricsView m={m} period={period} from={from} to={to} />
}
