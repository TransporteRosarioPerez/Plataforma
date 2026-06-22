'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { validateIssueBeforeExpiry } from '@/lib/documents/dates'
import type { DocumentRecord } from '@/lib/types'

export const ACCEPTED_DOCUMENT_FILES = '.pdf,.jpg,.jpeg,.png'

type DocumentDateFileFieldsProps = {
  file: File | null
  setFile: (f: File | null) => void
  pending: boolean
  editing?: DocumentRecord | null
  requireExpiry?: boolean
  hideExpiry?: boolean
}

function toDateInputValue(date?: Date) {
  return date?.toISOString().slice(0, 10) ?? ''
}

export function DocumentDateFileFields({
  file,
  setFile,
  pending,
  editing,
  requireExpiry,
  hideExpiry,
}: DocumentDateFileFieldsProps) {
  const [issueDate, setIssueDate] = useState(() => toDateInputValue(editing?.issueDate))
  const [expiryDate, setExpiryDate] = useState(() => toDateInputValue(editing?.expiryDate))

  useEffect(() => {
    setIssueDate(toDateInputValue(editing?.issueDate))
    setExpiryDate(toDateInputValue(editing?.expiryDate))
  }, [editing?.id, editing?.issueDate, editing?.expiryDate])

  const dateError = hideExpiry ? null : validateIssueBeforeExpiry(issueDate, expiryDate)

  return (
    <>
      <div className={`grid gap-3 ${hideExpiry ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <Field>
          <FieldLabel>Emisión</FieldLabel>
          <Input
            name="issue_date"
            type="date"
            value={issueDate}
            max={expiryDate || undefined}
            onChange={(e) => setIssueDate(e.target.value)}
            disabled={pending}
          />
        </Field>
        {!hideExpiry && (
          <Field>
            <FieldLabel>Vencimiento{requireExpiry ? ' *' : ''}</FieldLabel>
            <Input
              name="expiry_date"
              type="date"
              value={expiryDate}
              min={issueDate || undefined}
              required={requireExpiry}
              onChange={(e) => setExpiryDate(e.target.value)}
              disabled={pending}
              aria-invalid={!!dateError}
            />
          </Field>
        )}
      </div>
      {dateError && (
        <p className="text-sm text-destructive" role="alert">
          {dateError}
        </p>
      )}
      <Field>
        <FieldLabel>Archivo (PDF, JPG o PNG)</FieldLabel>
        <Input
          type="file"
          accept={ACCEPTED_DOCUMENT_FILES}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={pending}
        />
        {editing?.fileName && !file && (
          <p className="text-xs text-muted-foreground mt-1">Actual: {editing.fileName}</p>
        )}
      </Field>
    </>
  )
}

export function DocumentNotesField({
  pending,
  defaultNotes,
}: {
  pending: boolean
  defaultNotes?: string
}) {
  return (
    <Field>
      <FieldLabel>Notas</FieldLabel>
      <Textarea name="notes" rows={2} defaultValue={defaultNotes ?? ''} disabled={pending} />
    </Field>
  )
}
