'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FormSheet } from '@/components/ui/form-sheet'
import { DocumentDateFileFields, DocumentNotesField } from '@/components/documents/document-form-fields'
import { renewEntityDocument } from '@/lib/actions/entity-documents'
import { validateIssueBeforeExpiry } from '@/lib/documents/dates'
import { appendUploadedFileToFormData } from '@/lib/documents/upload-entity-file'
import type { DocumentEntityType } from '@/lib/types'

export type DocumentRenewTarget = {
  id: string
  entityId: string
  entityType: DocumentEntityType
  name: string
  entityLabel?: string
}

type DocumentRenewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: DocumentRenewTarget | null
}

export function DocumentRenewDialog({ open, onOpenChange, document }: DocumentRenewDialogProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (!next) setFile(null)
    onOpenChange(next)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!document) return

    setPending(true)
    try {
      const formData = new FormData(e.currentTarget)
      const dateError = validateIssueBeforeExpiry(
        formData.get('issue_date')?.toString(),
        formData.get('expiry_date')?.toString()
      )
      if (dateError) {
        toast.error(dateError)
        return
      }

      const upload = await appendUploadedFileToFormData(
        formData,
        document.entityType,
        document.entityId,
        file
      )
      if (!upload.ok) {
        toast.error(upload.error)
        return
      }

      const result = await renewEntityDocument({}, formData)
      if (result.error) toast.error(result.error)
      else {
        toast.success(result.success)
        handleOpenChange(false)
        router.refresh()
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      size="default"
      title={document ? `Renovar ${document.name}` : 'Renovar documento'}
      description={
        document?.entityLabel
          ? `${document.entityLabel} — subí la nueva versión con su vencimiento. La actual pasa al historial.`
          : 'Subí la nueva versión con su vencimiento. La actual pasa al historial.'
      }
      footer={
        document ? (
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" form="document-renew-form" className="flex-1" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar renovación
            </Button>
          </div>
        ) : null
      }
    >
      {document && (
        <form id="document-renew-form" onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={document.id} />
          <input type="hidden" name="entity_id" value={document.entityId} />
          <input type="hidden" name="entity_type" value={document.entityType} />

          <DocumentDateFileFields
            file={file}
            setFile={setFile}
            pending={pending}
            requireExpiry
          />
          <DocumentNotesField pending={pending} />
        </form>
      )}
    </FormSheet>
  )
}
