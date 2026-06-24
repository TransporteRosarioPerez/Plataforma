import type { RestorableEntity } from '@/lib/actions/restore'

const ENTITY_LABELS: Record<RestorableEntity, string> = {
  client: 'Cliente de facturación',
  arcor_client: 'Cuenta de viaje',
  vehicle: 'Vehículo',
  driver: 'Chofer',
  trip: 'Viaje',
  proforma: 'Proforma',
  entity_document: 'Documento',
  trip_expense: 'Gasto de viaje',
  trip_observation: 'Observación de viaje',
  trip_document: 'Documento de viaje',
  expense_category: 'Categoría de gasto',
  inventory_item: 'Ítem de inventario',
  inventory_movement: 'Movimiento de inventario',
  invoice: 'Factura',
}

export function getEntityTypeLabel(entity: RestorableEntity): string {
  return ENTITY_LABELS[entity]
}
