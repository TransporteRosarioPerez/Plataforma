import { requireSuperadmin } from '@/lib/auth/session'
import { getCashKpis } from '@/lib/data/cash-kpis'
import { getOperationalKpis } from '@/lib/data/dashboard-kpis'
import { parseDashboardPeriod } from '@/lib/dashboard/periods'
import { parseReportView } from '@/lib/dashboard/report-view'
import { ReportesView } from '@/components/reportes/reportes-view'

type ReportesPageProps = {
  searchParams: Promise<{ period?: string; view?: string }>
}

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  await requireSuperadmin()
  const params = await searchParams
  const period = parseDashboardPeriod(params.period)
  const view = parseReportView(params.view)

  const [operationalData, cashData] = await Promise.all([
    getOperationalKpis(period),
    getCashKpis(period),
  ])

  return (
    <ReportesView
      view={view}
      operationalData={operationalData}
      cashData={cashData}
    />
  )
}
