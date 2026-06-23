'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type FuelImportDropzoneProps = {
  onFileRead: (text: string, fileName: string) => void
  disabled?: boolean
}

export function FuelImportDropzone({ onFileRead, disabled }: FuelImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) return
    const text = await file.text()
    onFileRead(text, file.name)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar extracto</CardTitle>
        <CardDescription>
          Subí un CSV de YPF o Shell. El formato se detecta automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (disabled) return
            const file = e.dataTransfer.files[0]
            if (file) void handleFile(file)
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
            disabled && 'pointer-events-none opacity-50'
          )}
        >
          <Upload className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Arrastrá el CSV acá o hacé clic para seleccionar
          </p>
          <Button type="button" variant="secondary" size="sm" disabled={disabled}>
            Elegir archivo
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />
      </CardContent>
    </Card>
  )
}
