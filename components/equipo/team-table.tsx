'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { updateUserRole } from '@/lib/actions/users'
import { roleLabels, type UserRole } from '@/lib/types'
import type { TeamProfile } from '@/lib/data/users'
import { toast } from 'sonner'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type TeamTableProps = {
  profiles: TeamProfile[]
  currentUserId: string
}

export function TeamTable({ profiles, currentUserId }: TeamTableProps) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Record<string, UserRole>>(() =>
    Object.fromEntries(profiles.map((p) => [p.id, p.role]))
  )

  const handleSave = async (userId: string) => {
    const role = roles[userId]
    const original = profiles.find((p) => p.id === userId)?.role
    if (!role || role === original) return

    setPendingId(userId)
    const result = await updateUserRole(userId, role)
    setPendingId(null)

    if (result.error) {
      toast.error(result.error)
      setRoles((prev) => ({ ...prev, [userId]: original ?? 'ops' }))
      return
    }

    toast.success(result.success ?? 'Rol actualizado')
    router.refresh()
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Alta</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead className="w-[100px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles.map((profile) => {
          const selectedRole = roles[profile.id] ?? profile.role
          const isDirty = selectedRole !== profile.role
          const isSelf = profile.id === currentUserId

          return (
            <TableRow key={profile.id}>
              <TableCell className="font-medium">
                {profile.name}
                {isSelf && (
                  <span className="ml-2 text-xs text-muted-foreground">(vos)</span>
                )}
              </TableCell>
              <TableCell>{profile.email}</TableCell>
              <TableCell className="text-muted-foreground">
                {dateFormatter.format(profile.createdAt)}
              </TableCell>
              <TableCell>
                <Select
                  value={selectedRole}
                  onValueChange={(value) =>
                    setRoles((prev) => ({ ...prev, [profile.id]: value as UserRole }))
                  }
                  disabled={isSelf && profile.role === 'superadmin'}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">{roleLabels.superadmin}</SelectItem>
                    <SelectItem value="ops">{roleLabels.ops}</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  disabled={!isDirty || pendingId === profile.id}
                  onClick={() => handleSave(profile.id)}
                >
                  {pendingId === profile.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
