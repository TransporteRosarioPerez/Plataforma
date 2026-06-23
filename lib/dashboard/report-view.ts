export type ReportView = 'operativo' | 'caja'

export const REPORT_VIEWS: ReportView[] = ['operativo', 'caja']

export const reportViewLabels: Record<ReportView, string> = {
  operativo: 'Operativo',
  caja: 'Caja',
}

export function parseReportView(value?: string | null): ReportView {
  return value === 'caja' ? 'caja' : 'operativo'
}
