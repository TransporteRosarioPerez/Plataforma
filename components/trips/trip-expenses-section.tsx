'use client'

import { useActionState, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
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
import { upsertTripExpense, deleteTripExpense } from '@/lib/actions/trip-expenses'
import type { Trip, TripExpense, ExpenseCategory } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const paidByLabels: Record<TripExpense['paidBy'], string> = {
  empresa: 'Empresa',
  chofer: 'Chofer',
}

const initialState: ActionState = {}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

type TripExpensesSectionProps = {
  trip: Trip
  expenses: TripExpense[]
  categories: ExpenseCategory[]
}

export function TripExpensesSection({ trip, expenses, categories }: TripExpensesSectionProps) {
  const router = useRouter()
  const activeCategories = categories.filter((c) => c.isActive)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TripExpense | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<TripExpense | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [paidBy, setPaidBy] = useState<TripExpense['paidBy']>('empresa')

  const [state, formAction, pending] = useActionState(upsertTripExpense, initialState)

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  const openCreate = () => {
    setEditing(null)
    setCategoryId(activeCategories[0]?.id ?? '')
    setPaidBy('empresa')
    setDialogOpen(true)
  }

  const openEdit = (expense: TripExpense) => {
    setEditing(expense)
    setCategoryId(expense.categoryId)
    setPaidBy(expense.paidBy)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    const result = await deleteTripExpense(toDelete.id, trip.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      router.refresh()
    }
    setDeleteOpen(false)
    setToDelete(null)
  }

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
      setDialogOpen(false)
      setEditing(null)
      router.refresh()
    }
    if (state.error) toast.error(state.error)
  }, [state, router])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Gastos del viaje
            </CardTitle>
            <CardDescription>
              {expenses.length} gasto{expenses.length === 1 ? '' : 's'} · total egresos{' '}
              <span className="font-semibold text-foreground">{formatCurrency(totalExpenses)}</span>
            </CardDescription>
          </div>
          <Button onClick={openCreate} disabled={activeCategories.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar gasto
          </Button>
        </CardHeader>
        <CardContent>
          {activeCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay categorías de gasto activas. Configuralas en Configuración → Categorías de Gastos.
            </p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sin gastos registrados. Los egresos se suman automáticamente al total del viaje.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Pagó</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">
                      {dateFormatter.format(expense.expenseDate)}
                    </TableCell>
                    <TableCell>{expense.categoryName ?? '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {expense.description || '—'}
                    </TableCell>
                    <TableCell>{paidByLabels[expense.paidBy]}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(expense)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setToDelete(expense)
                            setDeleteOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        size="narrow"
        title={editing ? 'Editar gasto' : 'Nuevo gasto'}
        footer={
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="trip-expense-form" className="flex-1" disabled={pending || !categoryId}>
              {editing ? 'Guardar' : 'Registrar'}
            </Button>
          </div>
        }
      >
        <form id="trip-expense-form" action={formAction} className="space-y-4">
          <input type="hidden" name="trip_id" value={trip.id} />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="category_id" value={categoryId} />
          <input type="hidden" name="paid_by" value={paidBy} />

          <Field>
            <FieldLabel>Categoría *</FieldLabel>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {activeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>Monto *</FieldLabel>
              <NumberInput
                name="amount"
                min={0.01}
                decimals={2}
                defaultValue={editing?.amount ?? ''}
                required
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel>Fecha *</FieldLabel>
              <Input
                name="expense_date"
                type="date"
                defaultValue={
                  editing
                    ? editing.expenseDate.toISOString().slice(0, 10)
                    : todayIso()
                }
                required
                disabled={pending}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Pagado por</FieldLabel>
            <Select value={paidBy} onValueChange={(v) => setPaidBy(v as TripExpense['paidBy'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empresa">Empresa</SelectItem>
                <SelectItem value="chofer">Chofer</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Descripción</FieldLabel>
            <Textarea
              name="description"
              rows={2}
              defaultValue={editing?.description ?? ''}
              disabled={pending}
            />
          </Field>
        </form>
      </FormSheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se restará del total de egresos del viaje.
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
