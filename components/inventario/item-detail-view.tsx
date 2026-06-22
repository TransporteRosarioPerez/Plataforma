'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MovementSheet } from '@/components/inventario/movement-sheet'
import { deleteInventoryMovement } from '@/lib/actions/inventory-movements'
import type { InventoryItem, InventoryMovement, InventoryMovementType } from '@/lib/types'
import {
  getInventoryStockStatus,
  inventoryMovementTypeLabels,
  inventoryStockStatusColors,
  inventoryStockStatusLabels,
} from '@/lib/types'
import { toast } from 'sonner'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type ItemDetailViewProps = {
  item: InventoryItem
  movements: InventoryMovement[]
  allItems: InventoryItem[]
}

export function ItemDetailView({ item, movements, allItems }: ItemDetailViewProps) {
  const router = useRouter()
  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<InventoryMovementType>('purchase')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<InventoryMovement | null>(null)

  const status = getInventoryStockStatus(item)

  const openMovement = (type: InventoryMovementType) => {
    setMovementType(type)
    setMovementOpen(true)
  }

  const handleDeleteMovement = async () => {
    if (!toDelete) return
    const result = await deleteInventoryMovement(toDelete.id, item.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      router.refresh()
    }
    setDeleteOpen(false)
    setToDelete(null)
  }

  const purchaseTotal = movements
    .filter((m) => m.movementType === 'purchase')
    .reduce((sum, m) => sum + (m.totalCost ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/inventario"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-bold">{item.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline" className={inventoryStockStatusColors[status]}>
              {inventoryStockStatusLabels[status]}
            </Badge>
            {item.category && (
              <Badge variant="outline">{item.category.name}</Badge>
            )}
            {!item.isActive && <Badge variant="outline">Inactivo</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => openMovement('purchase')}>
            <ArrowUpCircle className="mr-2 h-4 w-4" />
            Compra
          </Button>
          <Button variant="outline" size="sm" onClick={() => openMovement('consumption')}>
            <ArrowDownCircle className="mr-2 h-4 w-4" />
            Consumo
          </Button>
          <Button variant="outline" size="sm" onClick={() => openMovement('adjustment')}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Ajuste
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {item.currentQuantity} <span className="text-base font-normal text-muted-foreground">{item.unit}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mínimo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{item.minQuantity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{movements.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total comprado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(purchaseTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {item.notes && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{item.notes}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sin movimientos. Registrá una compra para iniciar el stock.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap">
                      {dateFormatter.format(movement.movementDate)}
                    </TableCell>
                    <TableCell>{inventoryMovementTypeLabels[movement.movementType]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {movement.movementType === 'consumption' || (movement.movementType === 'adjustment' && movement.adjustmentDirection === 'decrease') ? '−' : '+'}
                      {movement.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {movement.totalCost != null ? formatCurrency(movement.totalCost) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                      {movement.movementType === 'purchase' && movement.supplierName
                        ? `${movement.supplierName}${movement.invoiceReference ? ` · ${movement.invoiceReference}` : ''}`
                        : movement.notes ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setToDelete(movement)
                          setDeleteOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MovementSheet
        open={movementOpen}
        onOpenChange={setMovementOpen}
        items={allItems}
        defaultItemId={item.id}
        defaultType={movementType}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se revertirá el efecto en el stock de {item.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMovement}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
