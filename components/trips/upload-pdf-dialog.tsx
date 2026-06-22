'use client'

import { useCallback, useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  generateTripPdfUploadUrl,
  registerTripPdf,
  suggestTripPdfFileName,
} from '@/lib/actions/trip-pdf'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type UploadPdfDialogProps = {
  tripId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UploadPdfDialog({ tripId, open, onOpenChange }: UploadPdfDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  const onDrop = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (picked.type !== 'application/pdf') {
      toast.error('Solo se permiten archivos PDF')
      return
    }
    setFile(picked)
  }, [])

  const handleUpload = async () => {
    if (!file) {
      toast.error('Seleccioná un PDF')
      return
    }

    setUploading(true)
    try {
      const suggested = await suggestTripPdfFileName(tripId)
      const fileName = suggested.fileName ?? file.name

      const urlResult = await generateTripPdfUploadUrl(tripId, fileName)
      if (urlResult.error || !urlResult.uploadUrl || !urlResult.storageKey) {
        toast.error(urlResult.error ?? 'Error al preparar subida')
        return
      }

      const putRes = await fetch(urlResult.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      })

      if (!putRes.ok) {
        toast.error('Error al subir el archivo a Spaces')
        return
      }

      const regResult = await registerTripPdf(tripId, urlResult.storageKey)
      if (regResult.error) {
        toast.error(regResult.error)
        return
      }

      toast.success('PDF subido correctamente')
      setFile(null)
      onOpenChange(false)
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir PDF del viaje</DialogTitle>
          <DialogDescription>
            El archivo se sube directamente a DigitalOcean Spaces (bucket privado).
          </DialogDescription>
        </DialogHeader>
        <div className="border border-dashed rounded-lg p-6 text-center">
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <input
            type="file"
            accept="application/pdf"
            onChange={onDrop}
            disabled={uploading}
            className="text-sm"
          />
          {file && <p className="mt-2 text-sm text-muted-foreground">{file.name}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Subir PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
