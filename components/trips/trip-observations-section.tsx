'use client'

import { useActionState, useEffect, useState } from 'react'
import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormSheet } from '@/components/ui/form-sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { upsertTripObservation, deleteTripObservation } from '@/lib/actions/trip-observations'
import type { Trip, TripObservation } from '@/lib/types'
import type { ActionState } from '@/lib/validations/parse-form'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const initialState: ActionState = {}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

type TripObservationsSectionProps = {
  trip: Trip
  observations: TripObservation[]
}

export function TripObservationsSection({ trip, observations }: TripObservationsSectionProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TripObservation | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<TripObservation | null>(null)

  const [state, formAction, pending] = useActionState(upsertTripObservation, initialState)

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (observation: TripObservation) => {
    setEditing(observation)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    const result = await deleteTripObservation(toDelete.id, trip.id)
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
    <>
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-4 w-4" />
              Observaciones ({observations.length})
            </CardTitle>
            <CardDescription>
              Notas operativas del viaje. Podés editarlas o recuperarlas desde Papelera si las das de baja.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            Agregar
          </Button>
        </CardHeader>
        <CardContent>
          {observations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin observaciones. Usá &quot;Agregar&quot; para registrar una nota sobre este viaje.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {observations.map((obs) => (
                <li key={obs.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap">{obs.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dateFormatter.format(obs.createdAt)}
                      {obs.updatedAt.getTime() !== obs.createdAt.getTime() && ' · editada'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(obs)} aria-label="Editar observación">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setToDelete(obs)
                        setDeleteOpen(true)
                      }}
                      aria-label="Dar de baja observación"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <FormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        size="narrow"
        title={editing ? 'Editar observación' : 'Nueva observación'}
        footer={
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="trip-observation-form" className="flex-1" disabled={pending}>
              {pending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}
            </Button>
          </div>
        }
      >
        <form id="trip-observation-form" action={formAction} className="space-y-4">
          <input type="hidden" name="trip_id" value={trip.id} />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <Field>
            <FieldLabel htmlFor="observation-content">Observación</FieldLabel>
            <Textarea
              id="observation-content"
              name="content"
              rows={5}
              required
              defaultValue={editing?.content ?? ''}
              placeholder="Ej.: demora en descarga, cambio de ruta, incidencia en cliente..."
            />
          </Field>
        </form>
      </FormSheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja esta observación?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de mostrarse en el viaje. Podés recuperarla desde Papelera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Dar de baja</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
