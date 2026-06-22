import { getDashboardKpis } from '@/lib/data/dashboard-kpis'
import { parseDashboardPeriod } from '@/lib/dashboard/periods'
import { ReportesView } from '@/components/reportes/reportes-view'

type ReportesPageProps = {
  searchParams: Promise<{ period?: string }>
}

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  const params = await searchParams
  const period = parseDashboardPeriod(params.period)
  const data = await getDashboardKpis(period)

  return <ReportesView data={data} />
}
