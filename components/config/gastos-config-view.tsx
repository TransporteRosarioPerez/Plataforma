'use client'

import { useState, useActionState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, ArrowLeft, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  upsertExpenseCategory,
  toggleExpenseCategory,
  deleteExpenseCategory,
} from '@/lib/actions/expense-categories'
import type { ExpenseCategory } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'

const initialState: ActionState = {}

type GastosConfigViewProps = {
  categories: ExpenseCategory[]
}

export function GastosConfigView({ categories }: GastosConfigViewProps) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [state, formAction, pending] = useActionState(upsertExpenseCategory, initialState)

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
      setShowNew(false)
      setNewName('')
    }
    if (state.error) toast.error(state.error)
  }, [state])

  const handleAdd = () => {
    if (!newName.trim()) return
    const fd = new FormData()
    fd.set('name', newName.trim())
    formAction(fd)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/configuracion"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Categorías de gastos</h1>
          <p className="text-muted-foreground">Clasificación de gastos de viaje</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Categorías</CardTitle>
            <CardDescription>{categories.length} configuradas</CardDescription>
          </div>
          <Button onClick={() => setShowNew(true)}><Plus className="mr-2 h-4 w-4" />Nueva</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showNew && (
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre" />
              <Button onClick={handleAdd} disabled={pending}>Agregar</Button>
              <Button variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
            </div>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{cat.name}</span>
                {cat.isDefault && <Badge variant="secondary">Default</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={cat.isActive}
                  onCheckedChange={async (v) => {
                    const r = await toggleExpenseCategory(cat.id, v)
                    if (r.error) toast.error(r.error)
                  }}
                />
                {!cat.isDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!confirm('¿Eliminar?')) return
                      const r = await deleteExpenseCategory(cat.id)
                      if (r.error) toast.error(r.error)
                      else toast.success('Eliminada')
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
