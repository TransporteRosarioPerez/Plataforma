'use client'

import { useMemo, useState, Fragment } from 'react'
import { Plus, Pencil, Trash2, Download, Loader2, RefreshCw, History, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  DocumentDateFileFields,
  DocumentNotesField,
} from '@/components/documents/document-form-fields'
import { DocumentRenewDialog } from '@/components/documents/document-renew-dialog'
import {
  upsertEntityDocument,
  deleteEntityDocument,
} from '@/lib/actions/entity-documents'
import { generateEntityDocumentDownloadUrl } from '@/lib/actions/entity-document-file'
import {
  documentStatusLabels,
  documentStatusColors,
} from '@/lib/documents/status'
import {
  intervalFrequencyOptions,
  isRenewableFrequency,
  renewalFrequencyLabels,
} from '@/lib/documents/renewal'
import { validateIssueBeforeExpiry } from '@/lib/documents/dates'
import { appendUploadedFileToFormData } from '@/lib/documents/upload-entity-file'
import type { DocumentRecord, DocumentEntityType, RenewalFrequency } from '@/lib/types'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type RenewalMode = 'once' | 'interval'

type EntityDocumentsPanelProps = {
  entityId: string
  entityType: DocumentEntityType
  documents: DocumentRecord[]
  history: DocumentRecord[]
}

export function EntityDocumentsPanel({
  entityId,
  entityType,
  documents,
  history,
}: EntityDocumentsPanelProps) {
  const router = useRouter()

  const historyByGroup = useMemo(() => {
    const map = new Map<string, DocumentRecord[]>()
    for (const row of history) {
      const list = map.get(row.documentGroupId) ?? []
      list.push(row)
      map.set(row.documentGroupId, list)
    }
    return map
  }, [history])

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())

  const [editing, setEditing] = useState<DocumentRecord | null>(null)
  const [renewing, setRenewing] = useState<DocumentRecord | null>(null)
  const [toDelete, setToDelete] = useState<DocumentRecord | null>(null)
  const [renewalMode, setRenewalMode] = useState<RenewalMode>('interval')
  const [renewalFrequency, setRenewalFrequency] = useState<RenewalFrequency>('monthly')
  const [pending, setPending] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const openCreate = () => {
    setRenewalMode('interval')
    setRenewalFrequency('monthly')
    setFile(null)
    setCreateOpen(true)
  }

  const openEdit = (doc: DocumentRecord) => {
    setEditing(doc)
    setFile(null)
    setEditOpen(true)
  }

  const openRenew = (doc: DocumentRecord) => {
    setRenewing(doc)
    setFile(null)
    setRenewOpen(true)
  }

  const toggleHistory = (groupId: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const uploadFileIfNeeded = async (formData: FormData) => {
    const result = await appendUploadedFileToFormData(formData, entityType, entityId, file)
    if (!result.ok) toast.error(result.error)
    return result.ok
  }

  const appendRenewalFields = (formData: FormData) => {
    formData.set('renewal_mode', renewalMode)
    if (renewalMode === 'interval') {
      formData.set('renewal_frequency', renewalFrequency)
    }
  }

  const validateFormDates = (formData: FormData) => {
    const error = validateIssueBeforeExpiry(
      formData.get('issue_date')?.toString(),
      formData.get('expiry_date')?.toString()
    )
    if (error) toast.error(error)
    return !error
  }

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    try {
      const formData = new FormData(e.currentTarget)
      appendRenewalFields(formData)
      if (!validateFormDates(formData)) return
      if (!(await uploadFileIfNeeded(formData))) return
      const result = await upsertEntityDocument({}, formData)
      if (result.error) toast.error(result.error)
      else {
        toast.success(result.success)
        setCreateOpen(false)
        router.refresh()
      }
    } finally {
      setPending(false)
    }
  }

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('renewal_mode', 'once')
      if (!validateFormDates(formData)) return
      if (!(await uploadFileIfNeeded(formData))) return
      const result = await upsertEntityDocument({}, formData)
      if (result.error) toast.error(result.error)
      else {
        toast.success(result.success)
        setEditOpen(false)
        setEditing(null)
        router.refresh()
      }
    } finally {
      setPending(false)
    }
  }

  const handleDownload = async (doc: DocumentRecord) => {
    if (!doc.fileUrl) return
    setDownloadingId(doc.id)
    try {
      const result = await generateEntityDocumentDownloadUrl(doc.fileUrl)
      if (result.error || !result.url) {
        toast.error(result.error ?? 'No se pudo descargar')
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    const result = await deleteEntityDocument(toDelete.id, entityType, entityId)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.success)
      router.refresh()
    }
    setDeleteOpen(false)
    setToDelete(null)
  }

  const renderHistoryRows = (groupId: string) => {
    const rows = historyByGroup.get(groupId) ?? []
    if (rows.length === 0) return null
    return rows.map((row) => (
      <TableRow key={row.id} className="bg-muted/30">
        <TableCell colSpan={2} className="text-xs text-muted-foreground pl-8">
          <span className="inline-flex items-center gap-1">
            <History className="h-3 w-3" />
            Anterior
            {row.supersededAt ? ` · ${dateFormatter.format(row.supersededAt)}` : ''}
          </span>
        </TableCell>
        <TableCell className="whitespace-nowrap text-sm">
          {row.expiryDate ? dateFormatter.format(row.expiryDate) : '—'}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={documentStatusColors[row.status]}>
            {documentStatusLabels[row.status]}
          </Badge>
        </TableCell>
        <TableCell>
          {row.fileUrl && (
            <Button variant="ghost" size="icon" onClick={() => handleDownload(row)}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Documentación ({documents.length})</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Nombrá el documento, indicá si es único o se renueva por intervalo, y cargá archivos.
              Las renovaciones quedan en el historial.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin documentos cargados. Agregá uno (ej. VTV, seguro, DNI).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const renewable = isRenewableFrequency(doc.renewalFrequency)
                  const groupId = doc.documentGroupId
                  const pastVersions = historyByGroup.get(groupId) ?? []
                  const historyOpen = expandedHistory.has(groupId)

                  return (
                    <Fragment key={doc.id}>
                      <TableRow>
                        <TableCell>
                          <div className="font-medium">{doc.name}</div>
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {renewalFrequencyLabels[doc.renewalFrequency]}
                          </Badge>
                          {doc.fileName && (
                            <div className="text-xs text-muted-foreground truncate max-w-[220px] mt-1">
                              {doc.fileName}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {isRenewableFrequency(doc.renewalFrequency) && doc.expiryDate
                            ? dateFormatter.format(doc.expiryDate)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {isRenewableFrequency(doc.renewalFrequency) ? (
                            <Badge variant="outline" className={documentStatusColors[doc.status]}>
                              {documentStatusLabels[doc.status]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin vencimiento</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {pastVersions.length > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Historial"
                                onClick={() => toggleHistory(groupId)}
                              >
                                {historyOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {doc.fileUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownload(doc)}
                                disabled={downloadingId === doc.id}
                              >
                                {downloadingId === doc.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {renewable ? (
                              <Button variant="ghost" size="icon" onClick={() => openRenew(doc)} title="Renovar">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => openEdit(doc)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setToDelete(doc)
                                setDeleteOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {historyOpen && renderHistoryRows(groupId)}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        size="default"
        title="Nuevo documento"
        description="Definí el nombre y si se renueva periódicamente o es un documento único."
        footer={
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" form="entity-doc-create-form" className="flex-1" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        }
      >
        <form id="entity-doc-create-form" onSubmit={handleCreate} className="space-y-4">
          <input type="hidden" name="entity_id" value={entityId} />
          <input type="hidden" name="entity_type" value={entityType} />

          <Field>
            <FieldLabel>Nombre *</FieldLabel>
            <Input name="name" placeholder="Ej. Póliza de seguro, VTV, DNI" required disabled={pending} />
          </Field>

          <RenewalModeFields
            renewalMode={renewalMode}
            renewalFrequency={renewalFrequency}
            onModeChange={setRenewalMode}
            onFrequencyChange={setRenewalFrequency}
            pending={pending}
          />

          <DocumentDateFileFields
            file={file}
            setFile={setFile}
            pending={pending}
            requireExpiry={renewalMode === 'interval'}
            hideExpiry={renewalMode === 'once'}
          />
          <DocumentNotesField pending={pending} />
        </form>
      </FormSheet>

      <FormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        size="default"
        title={editing ? `Editar ${editing.name}` : 'Editar documento'}
        description="Documento único — se actualiza sin historial de versiones."
        footer={
          editing ? (
            <div className="flex w-full gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" form="entity-doc-edit-form" className="flex-1" disabled={pending}>
                Guardar
              </Button>
            </div>
          ) : null
        }
      >
        {editing && (
          <form id="entity-doc-edit-form" onSubmit={handleEdit} className="space-y-4">
            <input type="hidden" name="id" value={editing.id} />
            <input type="hidden" name="entity_id" value={entityId} />
            <input type="hidden" name="entity_type" value={entityType} />

            <Field>
              <FieldLabel>Nombre *</FieldLabel>
              <Input name="name" defaultValue={editing.name} required disabled={pending} />
            </Field>

            <DocumentDateFileFields
              file={file}
              setFile={setFile}
              pending={pending}
              editing={editing}
              hideExpiry
            />
            <DocumentNotesField pending={pending} defaultNotes={editing.notes} />
          </form>
        )}
      </FormSheet>

      <DocumentRenewDialog
        open={renewOpen}
        onOpenChange={(open) => {
          setRenewOpen(open)
          if (!open) setRenewing(null)
        }}
        document={
          renewing
            ? {
                id: renewing.id,
                entityId,
                entityType,
                name: renewing.name,
              }
            : null
        }
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento vigente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quita el registro actual. El historial de versiones anteriores se mantiene.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function RenewalModeFields({
  renewalMode,
  renewalFrequency,
  onModeChange,
  onFrequencyChange,
  pending,
}: {
  renewalMode: RenewalMode
  renewalFrequency: RenewalFrequency
  onModeChange: (mode: RenewalMode) => void
  onFrequencyChange: (frequency: RenewalFrequency) => void
  pending: boolean
}) {
  return (
    <>
      <Field>
        <FieldLabel>Vigencia *</FieldLabel>
        <Select
          value={renewalMode}
          onValueChange={(v) => onModeChange(v as RenewalMode)}
          disabled={pending}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="once">Único (sin vencimiento)</SelectItem>
            <SelectItem value="interval">Por intervalo de tiempo</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {renewalMode === 'interval' && (
        <Field>
          <FieldLabel>Se renueva cada *</FieldLabel>
          <Select
            value={renewalFrequency}
            onValueChange={(v) => onFrequencyChange(v as RenewalFrequency)}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intervalFrequencyOptions.map((freq) => (
                <SelectItem key={freq} value={freq}>
                  {renewalFrequencyLabels[freq]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </>
  )
}
