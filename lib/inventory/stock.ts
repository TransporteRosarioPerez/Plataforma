import type { InventoryAdjustmentDirection, InventoryMovementType } from '@/lib/types'

export function getMovementQuantityDelta(
  movementType: InventoryMovementType,
  quantity: number,
  adjustmentDirection?: InventoryAdjustmentDirection
): number {
  if (movementType === 'purchase') return quantity
  if (movementType === 'consumption') return -quantity
  if (adjustmentDirection === 'increase') return quantity
  if (adjustmentDirection === 'decrease') return -quantity
  throw new Error('Dirección de ajuste inválida')
}

export function wouldStockGoNegative(currentQuantity: number, delta: number): boolean {
  return currentQuantity + delta < 0
}
