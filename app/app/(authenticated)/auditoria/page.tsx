import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuditLogsView } from '@/components/auditoria/audit-logs-view'
import { parseAuditLogFilters } from '@/lib/audit/list-filters'
import { requireSuperadmin } from '@/lib/auth/session'
import { getAuditLogs } from '@/lib/data/audit-logs'
import { getTeamProfiles } from '@/lib/data/users'

type AuditoriaPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AuditoriaPage({ searchParams }: AuditoriaPageProps) {
  await requireSuperadmin()
  const params = await searchParams
  const filters = parseAuditLogFilters(params)

  const [result, profiles] = await Promise.all([
    getAuditLogs(filters),
    getTeamProfiles(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoría</h1>
        <p className="text-muted-foreground">
          Registro de actividad de todos los usuarios (operadores y superadministradores).
          Solo visible para superadmin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logs de actividad</CardTitle>
          <CardDescription>
            Quién hizo qué y cuándo, sin importar el rol. Los registros se purgan automáticamente después de 90 días.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogsView result={result} filters={filters} profiles={profiles} />
        </CardContent>
      </Card>
    </div>
  )
}
