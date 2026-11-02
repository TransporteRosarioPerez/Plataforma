'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FREQUENCY_LABELS, LOAD_TYPE_LABELS, SERVICE_LABELS } from '@/lib/crm/constants'
import type { CrmFrequency, CrmLoadType, CrmServiceType } from '@/lib/crm/types'

export type QuoteFieldsValue = {
  origin: string
  destination: string
  serviceType: CrmServiceType | null
  loadType: CrmLoadType | null
  pallets: number | null
  weightKg: number | null
  loadDate: string | null
  frequency: CrmFrequency | null
}

const NONE = '__none'

function EnumSelect<T extends string>({ value, onChange, labels, placeholder }: { value: T | null; onChange: (v: T | null) => void; labels: Record<T, string>; placeholder: string }) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : (v as T))}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sin definir</SelectItem>
        {(Object.keys(labels) as T[]).map((k) => (
          <SelectItem key={k} value={k}>{labels[k]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Campos operativos de una cotización (los usa la Bandeja y el detalle). */
export function QuoteFields({ value, onChange, idPrefix }: { value: QuoteFieldsValue; onChange: (v: QuoteFieldsValue) => void; idPrefix: string }) {
  const set = <K extends keyof QuoteFieldsValue>(k: K, v: QuoteFieldsValue[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 space-y-1">
        <Label htmlFor={`${idPrefix}-origin`} className="text-xs">Origen</Label>
        <Input id={`${idPrefix}-origin`} value={value.origin} placeholder="Buenos Aires" onChange={(e) => set('origin', e.target.value)} />
      </div>
      <div className="col-span-2 space-y-1">
        <Label htmlFor={`${idPrefix}-dest`} className="text-xs">Destino</Label>
        <Input id={`${idPrefix}-dest`} value={value.destination} placeholder="Ciudad, provincia" onChange={(e) => set('destination', e.target.value)} />
      </div>
      <div className="col-span-2 space-y-1 sm:col-span-1">
        <Label className="text-xs">Servicio</Label>
        <EnumSelect value={value.serviceType} onChange={(v) => set('serviceType', v)} labels={SERVICE_LABELS} placeholder="Servicio" />
      </div>
      <div className="col-span-2 space-y-1 sm:col-span-1">
        <Label className="text-xs">Tipo de carga</Label>
        <EnumSelect value={value.loadType} onChange={(v) => set('loadType', v)} labels={LOAD_TYPE_LABELS} placeholder="Tipo" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-pallets`} className="text-xs">Pallets</Label>
        <NumberInput id={`${idPrefix}-pallets`} value={value.pallets ?? ''} onValueChange={(v) => set('pallets', v ? Math.round(v) : null)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-kg`} className="text-xs">Peso (kg)</Label>
        <NumberInput id={`${idPrefix}-kg`} value={value.weightKg ?? ''} onValueChange={(v) => set('weightKg', v || null)} />
      </div>
      <div className="col-span-2 space-y-1 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-date`} className="text-xs">Fecha de carga</Label>
        <Input id={`${idPrefix}-date`} type="date" value={value.loadDate ?? ''} onChange={(e) => set('loadDate', e.target.value || null)} />
      </div>
      <div className="col-span-2 space-y-1 sm:col-span-2">
        <Label className="text-xs">Frecuencia</Label>
        <EnumSelect value={value.frequency} onChange={(v) => set('frequency', v)} labels={FREQUENCY_LABELS} placeholder="Frecuencia" />
      </div>
    </div>
  )
}
