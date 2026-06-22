'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Truck, Search, MoreHorizontal, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { VehicleSheet } from '@/components/fleet/vehicle-sheet'
import { deleteVehicle } from '@/lib/actions/vehicles'
import type { Vehicle, DocumentRecord } from '@/lib/types'
import { toast } from 'sonner'

const vehicleTypeLabels: Record<string, string> = {
  truck: 'Camión', semi: 'Semi', trailer: 'Acoplado',
}
const statusLabels: Record<string, string> = {
  active: 'Activo', maintenance: 'En mantenimiento', inactive: 'Inactivo',
}
const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  maintenance: 'bg-warning/10 text-warning-foreground border-warning/20',
  inactive: 'bg-muted text-muted-foreground border-border',
}

type FlotaViewProps = {
  vehicles: Vehicle[]
  documents: DocumentRecord[]
}

export function FlotaView({ vehicles, documents }: FlotaViewProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)

  const filtered = vehicles.filter((v) => {
    const matchesSearch =
      v.plate.toLowerCase().includes(search.toLowerCase()) ||
      v.brand.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || v.type === typeFilter
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  const trucks = filtered.filter((v) => v.type === 'truck')
  const semis = filtered.filter((v) => v.type === 'semi')
  const trailers = filtered.filter((v) => v.type === 'trailer')

  const getDocStatus = (vehicleId: string) => {
    const vehicleDocs = documents.filter((d) => d.entityId === vehicleId)
    const expired = vehicleDocs.filter((d) => d.status === 'expired').length
    const expiring = vehicleDocs.filter((d) => d.status === 'expiring_soon').length
    if (expired > 0) return { icon: AlertTriangle, color: 'text-destructive', label: `${expired} vencido(s)` }
    if (expiring > 0) return { icon: Clock, color: 'text-warning-foreground', label: `${expiring} por vencer` }
    if (vehicleDocs.length > 0) return { icon: CheckCircle2, color: 'text-success', label: 'Al día' }
    return { icon: Clock, color: 'text-muted-foreground', label: 'Sin docs' }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Dar de baja este vehículo? Podés recuperarlo desde Papelera.')) return
    const result = await deleteVehicle(id)
    if (result.error) toast.error(result.error)
    else toast.success(result.success)
  }

  const renderTable = (list: Vehicle[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patente</TableHead>
          <TableHead>Vehículo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Documentación</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((vehicle) => {
          const docStatus = getDocStatus(vehicle.id)
          const DocIcon = docStatus.icon
          return (
            <TableRow key={vehicle.id}>
              <TableCell className="font-mono font-medium">
                <Link href={`/app/flota/${vehicle.id}`} className="hover:underline">{vehicle.plate}</Link>
              </TableCell>
              <TableCell>
                <div>{vehicle.brand} {vehicle.model}</div>
                <div className="text-xs text-muted-foreground">{vehicle.year} · {vehicleTypeLabels[vehicle.type]}</div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusColors[vehicle.status]}>{statusLabels[vehicle.status]}</Badge>
              </TableCell>
              <TableCell>
                <div className={`flex items-center gap-1 text-sm ${docStatus.color}`}>
                  <DocIcon className="h-4 w-4" />{docStatus.label}
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/app/flota/${vehicle.id}`}>Ver detalle</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setEditingVehicle(vehicle); setDialogOpen(true) }}>Editar</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(vehicle.id)}>Eliminar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flota</h1>
          <p className="text-muted-foreground">{vehicles.length} vehículos</p>
        </div>
        <Button onClick={() => { setEditingVehicle(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />Nuevo vehículo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar patente, marca..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-md border px-3 text-sm">
              <option value="all">Todos los tipos</option>
              <option value="truck">Camiones</option>
              <option value="semi">Semis</option>
              <option value="trailer">Acoplados</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border px-3 text-sm">
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay vehículos</p>
            </div>
          ) : (
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">Todos ({filtered.length})</TabsTrigger>
                <TabsTrigger value="truck">Camiones ({trucks.length})</TabsTrigger>
                <TabsTrigger value="semi">Semis ({semis.length})</TabsTrigger>
                <TabsTrigger value="trailer">Acoplados ({trailers.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4">{renderTable(filtered)}</TabsContent>
              <TabsContent value="truck" className="mt-4">{renderTable(trucks)}</TabsContent>
              <TabsContent value="semi" className="mt-4">{renderTable(semis)}</TabsContent>
              <TabsContent value="trailer" className="mt-4">{renderTable(trailers)}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <VehicleSheet open={dialogOpen} onOpenChange={setDialogOpen} vehicle={editingVehicle} />
    </div>
  )
}
