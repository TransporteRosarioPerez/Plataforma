'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Package, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { FormSheet } from '@/components/ui/form-sheet'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { MovementSheet } from '@/components/inventario/movement-sheet'
import { upsertInventoryItem, deleteInventoryItem } from '@/lib/actions/inventory-items'
import type { InventoryCategory, InventoryItem, InventoryMovementType } from '@/lib/types'
import {
  getInventoryStockStatus,
  inventoryStockStatusColors,
  inventoryStockStatusLabels,
} from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const initialState: ActionState = {}

type InventarioViewProps = {
  items: InventoryItem[]
  categories: InventoryCategory[]
  purchaseTotalMonth: number
}

export function InventarioView({ items, categories, purchaseTotalMonth }: InventarioViewProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<InventoryItem | null>(null)

  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<InventoryMovementType>('purchase')

  const [itemState, itemAction, itemPending] = useActionState(upsertInventoryItem, initialState)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter((item) => {
      const matchSearch =
        !search ||
        item.name.toLowerCase().includes(q) ||
        (item.sku?.toLowerCase().includes(q) ?? false)
      const matchCategory =
        categoryFilter === 'all' || item.categoryId === categoryFilter
      const matchLow = !lowStockOnly || getInventoryStockStatus(item) !== 'ok'
      return matchSearch && matchCategory && matchLow
    })
  }, [items, search, categoryFilter, lowStockOnly])

  const lowStockCount = items.filter(
    (item) => item.isActive && getInventoryStockStatus(item) !== 'ok'
  ).length

  const openCreateItem = () => {
    setEditingItem(null)
    setCategoryId('__none__')
    setItemDialogOpen(true)
  }

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item)
    setCategoryId(item.categoryId ?? '__none__')
    setItemDialogOpen(true)
  }

  const openMovement = (type: InventoryMovementType) => {
    setMovementType(type)
    setMovementOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    const result = await deleteInventoryItem(toDelete.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      router.refresh()
    }
    setDeleteOpen(false)
    setToDelete(null)
  }

  useEffect(() => {
    if (itemState.success) {
      toast.success(itemState.success)
      setItemDialogOpen(false)
      setEditingItem(null)
      router.refresh()
    }
    if (itemState.error) toast.error(itemState.error)
  }, [itemState, router])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground">
            Stock de insumos y compras operativas de la empresa
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openMovement('consumption')}>
            <ArrowDownCircle className="mr-2 h-4 w-4" />
            Consumo
          </Button>
          <Button variant="outline" onClick={() => openMovement('purchase')}>
            <ArrowUpCircle className="mr-2 h-4 w-4" />
            Compra
          </Button>
          <Button onClick={openCreateItem}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo ítem
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ítems activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.filter((i) => i.isActive).length}</div>
          </CardContent>
        </Card>
        <Card className={lowStockCount > 0 ? 'border-amber-500/30' : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock bajo / sin stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-amber-700' : ''}`}>
              {lowStockCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compras este mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(purchaseTotalMonth)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Catálogo de ítems
              </CardTitle>
              <CardDescription>{filtered.length} ítem{filtered.length === 1 ? '' : 's'}</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ítem o SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-full sm:w-[220px]"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={lowStockOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLowStockOnly((v) => !v)}
              >
                Solo stock bajo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No hay ítems que coincidan con los filtros.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ítem</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const status = getInventoryStockStatus(item)
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          href={`/app/inventario/${item.id}`}
                          className="font-medium hover:underline"
                        >
                          {item.name}
                        </Link>
                        {item.sku && (
                          <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                        )}
                        {!item.isActive && (
                          <Badge variant="outline" className="mt-1">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.category?.name ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.currentQuantity} {item.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {item.minQuantity}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={inventoryStockStatusColors[status]}>
                          {inventoryStockStatusLabels[status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditItem(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setToDelete(item)
                              setDeleteOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MovementSheet
        open={movementOpen}
        onOpenChange={setMovementOpen}
        items={items}
        defaultType={movementType}
      />

      <FormSheet
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        size="default"
        title={editingItem ? 'Editar ítem' : 'Nuevo ítem'}
        footer={
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setItemDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="inventory-item-form" className="flex-1" disabled={itemPending}>
              {editingItem ? 'Guardar' : 'Crear ítem'}
            </Button>
          </div>
        }
      >
        <form id="inventory-item-form" action={itemAction} className="space-y-4">
          {editingItem && <input type="hidden" name="id" value={editingItem.id} />}
          <input type="hidden" name="category_id" value={categoryId === '__none__' ? '' : categoryId} />
          <Field>
            <FieldLabel>Nombre *</FieldLabel>
            <Input name="name" defaultValue={editingItem?.name ?? ''} required disabled={itemPending} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>SKU / código</FieldLabel>
              <Input name="sku" defaultValue={editingItem?.sku ?? ''} disabled={itemPending} />
            </Field>
            <Field>
              <FieldLabel>Unidad *</FieldLabel>
              <Input
                name="unit"
                defaultValue={editingItem?.unit ?? 'unidad'}
                required
                disabled={itemPending}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Categoría</FieldLabel>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={itemPending}>
              <SelectTrigger>
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin categoría</SelectItem>
                {categories.filter((c) => c.isActive).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Stock mínimo (alerta)</FieldLabel>
            <NumberInput
              name="min_quantity"
              min={0}
              decimals={2}
              defaultValue={editingItem?.minQuantity ?? 0}
              disabled={itemPending}
            />
          </Field>
          <Field>
            <FieldLabel>Notas</FieldLabel>
            <Textarea name="notes" rows={2} defaultValue={editingItem?.notes ?? ''} disabled={itemPending} />
          </Field>
        </form>
      </FormSheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja este ítem?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.name} dejará de aparecer en listados. Podés recuperarlo desde Papelera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
