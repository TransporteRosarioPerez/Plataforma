import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireSession } from '@/lib/auth/session'
import { roleLabels } from '@/lib/types'

export default async function EquipoPage() {
  const { profile } = await requireSession()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>
        <p className="text-muted-foreground">
          Gestión de usuarios vía Supabase Auth. Invitaciones en iteración futura.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tu sesión</CardTitle>
          <CardDescription>Usuario autenticado actualmente</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="text-muted-foreground">Nombre:</span> {profile.name}</p>
          <p><span className="text-muted-foreground">Email:</span> {profile.email}</p>
          <p><span className="text-muted-foreground">Rol:</span> {roleLabels[profile.role]}</p>
        </CardContent>
      </Card>
    </div>
  )
}
