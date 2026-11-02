/**
 * Precio sugerido a partir del tarifario (origen Buenos Aires).
 * Parcial: pallets × precio por pallet, con tope en el precio del semi completo.
 * Completo (≥ 30 pallets o "semi completo"): precio del semi.
 * Congelado: + recargo % de la provincia.
 */
import { PALLETS_PER_SEMI } from './constants'
import type { CrmLoadType, CrmRate, CrmServiceType } from './types'

export type PriceSuggestion = {
  amount: number
  detail: string
}

export function suggestPrice(
  rate: Pick<CrmRate, 'pricePerPallet' | 'priceFullTruck' | 'frozenSurchargePct' | 'isActive' | 'province'> | null | undefined,
  input: { pallets: number | null; loadType: CrmLoadType | null; serviceType: CrmServiceType | null },
): PriceSuggestion | null {
  if (!rate || !rate.isActive) return null
  const full = input.loadType === 'completa' || (input.pallets ?? 0) >= PALLETS_PER_SEMI
  let base: number | null = null
  let detail = ''
  if (full) {
    if (rate.priceFullTruck) {
      base = rate.priceFullTruck
      detail = `Semi completo a ${rate.province}`
    } else if (rate.pricePerPallet) {
      base = rate.pricePerPallet * PALLETS_PER_SEMI
      detail = `${PALLETS_PER_SEMI} pallets × ${fmt(rate.pricePerPallet)}`
    }
  } else if (input.pallets && rate.pricePerPallet) {
    base = input.pallets * rate.pricePerPallet
    detail = `${input.pallets} pallets × ${fmt(rate.pricePerPallet)}`
    if (rate.priceFullTruck && base > rate.priceFullTruck) {
      base = rate.priceFullTruck
      detail += ' (tope semi completo)'
    }
  }
  if (base === null) return null
  if (input.serviceType === 'congelado' && rate.frozenSurchargePct > 0) {
    base = base * (1 + rate.frozenSurchargePct / 100)
    detail += ` + ${rate.frozenSurchargePct}% congelado`
  }
  return { amount: Math.round(base), detail }
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
