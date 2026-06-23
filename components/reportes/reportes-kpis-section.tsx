'use client'

import type { CashKpiData } from '@/lib/data/cash-kpis'
import type { DashboardKpiData } from '@/lib/data/dashboard-kpis'
import { ReportesCajaSection } from '@/components/reportes/reportes-caja-section'
import { ReportesOperativoSection } from '@/components/reportes/reportes-operativo-section'
import {
  ReportPeriodControls,
  ReportViewTabs,
  type ReportView,
} from '@/components/reportes/reportes-shared'

type ReportesKpisSectionProps = {
  view: ReportView
  operationalData: DashboardKpiData
  cashData: CashKpiData
}

export function ReportesKpisSection({ view, operationalData, cashData }: ReportesKpisSectionProps) {
  const rangeLabel = view === 'caja' ? cashData.rangeLabel : operationalData.rangeLabel
  const period = view === 'caja' ? cashData.period : operationalData.period

  return (
    <div className="space-y-6">
      <ReportViewTabs view={view} />
      <ReportPeriodControls period={period} rangeLabel={rangeLabel} />
      {view === 'caja' ? (
        <ReportesCajaSection data={cashData} />
      ) : (
        <ReportesOperativoSection data={operationalData} />
      )}
    </div>
  )
}
