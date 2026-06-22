import type { RenewalFrequency } from '@/lib/types'

export function isRenewableFrequency(frequency: RenewalFrequency): boolean {
  return frequency !== 'once'
}

export const renewalFrequencyLabels: Record<RenewalFrequency, string> = {
  monthly: 'Mensual',
  biannual: 'Semestral',
  yearly: 'Anual',
  triennial: 'Cada 3 años',
  once: 'Único',
}

export const intervalFrequencyOptions: Exclude<RenewalFrequency, 'once'>[] = [
  'monthly',
  'biannual',
  'yearly',
  'triennial',
]
