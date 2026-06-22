'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateTripPdfDownloadUrl } from '@/lib/actions/trip-pdf'
import { toast } from 'sonner'

type DownloadPdfButtonProps = {
  tripId: string
  fileName?: string
  variant?: 'default' | 'outline' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function DownloadPdfButton({
  tripId,
  fileName,
  variant = 'outline',
  size = 'sm',
}: DownloadPdfButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const result = await generateTripPdfDownloadUrl(tripId)
      if (result.error || !result.url) {
        toast.error(result.error ?? 'No se pudo descargar el PDF')
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleDownload} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {fileName ? `Descargar ${fileName}` : 'Descargar PDF'}
    </Button>
  )
}
