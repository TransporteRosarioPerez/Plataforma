import { Suspense } from 'react'
import { ReportesKpisSection } from '@/components/reportes/reportes-kpis-section'
import type { ReportView } from '@/lib/dashboard/report-view'
import type { CashKpiData } from '@/lib/data/cash-kpis'
import type { DashboardKpiData } from '@/lib/data/dashboard-kpis'

type ReportesViewProps = {
  view: ReportView
  operationalData: DashboardKpiData
  cashData: CashKpiData
}

export function ReportesView({ view, operationalData, cashData }: ReportesViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">
          Operativo: rentabilidad por viaje. Caja: facturado y cobrado por fecha de factura.
        </p>
      </div>

      <Suspense fallback={<div className="h-96 rounded-lg border bg-muted/20 animate-pulse" />}>
        <ReportesKpisSection
          view={view}
          operationalData={operationalData}
          cashData={cashData}
        />
      </Suspense>
    </div>
  )
}
