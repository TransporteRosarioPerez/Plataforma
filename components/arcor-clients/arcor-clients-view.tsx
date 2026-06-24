'use client'

import { useEffect, useState } from 'react'
import {
  Plus, Search, Building2, MapPin, MoreHorizontal, Pencil, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ArcorClientSheet } from '@/components/arcor-clients/arcor-client-sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteArcorClient } from '@/lib/actions/arcor-clients'
import type { ArcorClient } from '@/lib/types'
import { toast } from 'sonner'

type ArcorClientsViewProps = {
  clients: ArcorClient[]
}

export function ArcorClientsView({ clients }: ArcorClientsViewProps) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ArcorClient | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<ArcorClient | null>(null)

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.accountId?.toLowerCase().includes(q) ?? false) ||
      (c.address?.toLowerCase().includes(q) ?? false)
    )
  })

  const openCreate = () => {
    setEditingClient(null)
    setDialogOpen(true)
  }

  const openEdit = (client: ArcorClient) => {
    setEditingClient(client)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!clientToDelete) return
    const result = await deleteArcorClient(clientToDelete.id)
    if (result.error) toast.error(result.error)
    else toast.success(result.success)
    setDeleteConfirmOpen(false)
    setClientToDelete(null)
  }

  useEffect(() => {
    if (!dialogOpen) setEditingClient(null)
  }, [dialogOpen])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cuentas de viaje</h1>
          <p className="text-muted-foreground">
            Catálogo operativo para elegir cliente al cargar un viaje. Distinto de los clientes de facturación.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva cuenta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Listado</CardTitle>
              <CardDescription>{filtered.length} cuentas</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nº, nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No hay cuentas registradas</p>
              <Button variant="link" onClick={openCreate}>Agregar la primera</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº cliente</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-mono text-sm">
                      {client.accountId || '—'}
                    </TableCell>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      {client.address ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{client.address}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(client)}>
                            <Pencil className="mr-2 h-4 w-4" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { setClientToDelete(client); setDeleteConfirmOpen(true) }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Eliminar
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

      <ArcorClientSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editingClient}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja esta cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              {clientToDelete?.name} dejará de aparecer en el selector de viajes. Podés recuperarla desde Papelera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
