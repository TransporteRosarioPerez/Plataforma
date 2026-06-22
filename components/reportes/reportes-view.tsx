import { Suspense } from 'react'
import { ReportesKpisSection } from '@/components/reportes/reportes-kpis-section'
import type { DashboardKpiData } from '@/lib/data/dashboard-kpis'

type ReportesViewProps = {
  data: DashboardKpiData
}

export function ReportesView({ data }: ReportesViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">
          Resultados del negocio por mes y período — ingresos, egresos y rentabilidad
        </p>
      </div>

      <Suspense fallback={<div className="h-96 rounded-lg border bg-muted/20 animate-pulse" />}>
        <ReportesKpisSection data={data} />
      </Suspense>
    </div>
  )
}
