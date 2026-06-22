'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, UserCircle, MoreHorizontal, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DriverSheet } from '@/components/drivers/driver-sheet'
import { deleteDriver } from '@/lib/actions/drivers'
import type { Driver } from '@/lib/types'
import { toast } from 'sonner'

type ChoferesViewProps = {
  drivers: Driver[]
}

export function ChoferesView({ drivers }: ChoferesViewProps) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)

  const filtered = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.dni.includes(search)
  )

  const handleDelete = async (id: string) => {
    if (!confirm('¿Dar de baja este chofer? Podés recuperarlo desde Papelera.')) return
    const result = await deleteDriver(id)
    if (result.error) toast.error(result.error)
    else toast.success(result.success)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Choferes</h1>
          <p className="text-muted-foreground">{drivers.length} conductores registrados</p>
        </div>
        <Button onClick={() => { setEditingDriver(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />Nuevo chofer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Listado</CardTitle>
              <CardDescription>{filtered.length} choferes</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay choferes</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <Link href={`/app/choferes/${driver.id}`} className="font-medium hover:underline">
                        {driver.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">{driver.dni}</TableCell>
                    <TableCell>
                      {driver.phone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />{driver.phone}
                        </div>
                      )}
                      {driver.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />{driver.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={driver.status === 'active' ? 'default' : 'secondary'}>
                        {driver.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/app/choferes/${driver.id}`}>Ver detalle</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditingDriver(driver); setDialogOpen(true) }}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(driver.id)}>
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DriverSheet open={dialogOpen} onOpenChange={setDialogOpen} driver={editingDriver} />
    </div>
  )
}
