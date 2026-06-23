import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeamTable } from '@/components/equipo/team-table'
import { requireSuperadmin } from '@/lib/auth/session'
import { getTeamProfiles } from '@/lib/data/users'

export default async function EquipoPage() {
  const { profile } = await requireSuperadmin()
  const profiles = await getTeamProfiles()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>
        <p className="text-muted-foreground">
          Gestioná los roles de los usuarios de la plataforma. Los usuarios nuevos se crean en
          Supabase Dashboard → Authentication → Users.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>
            {profiles.length} usuario{profiles.length === 1 ? '' : 's'} registrado
            {profiles.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay usuarios en la plataforma.</p>
          ) : (
            <TeamTable profiles={profiles} currentUserId={profile.id} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
