export const AUDIT_ACTIONS = {
  authSignIn: 'auth.sign_in',
  authSignOut: 'auth.sign_out',

  tripCreate: 'trip.create',
  tripUpdate: 'trip.update',
  tripStatusUpdate: 'trip.status_update',
  tripEstimateUpdate: 'trip.estimate_update',
  tripDelete: 'trip.delete',
  tripPdfRegister: 'trip.pdf.register',
  tripPdfUpload: 'trip.pdf.upload',
  tripPdfDownload: 'trip.pdf.download',

  tripObservationUpsert: 'trip_observation.upsert',
  tripObservationDelete: 'trip_observation.delete',
  tripDocumentAdd: 'trip_document.add',
  tripDocumentDelete: 'trip_document.delete',
  tripBillingUpdate: 'trip_billing.update',
  tripExpenseUpsert: 'trip_expense.upsert',
  tripExpenseDelete: 'trip_expense.delete',

  proformaCreate: 'proforma.create',
  proformaUpdate: 'proforma.update',
  proformaDelete: 'proforma.delete',
  proformaUpload: 'proforma.upload',
  proformaDownload: 'proforma.download',

  arcorClientUpsert: 'arcor_client.upsert',
  arcorClientDelete: 'arcor_client.delete',

  clientUpsert: 'client.upsert',
  clientDelete: 'client.delete',

  vehicleUpsert: 'vehicle.upsert',
  vehicleDelete: 'vehicle.delete',
  driverUpsert: 'driver.upsert',
  driverDelete: 'driver.delete',

  entityDocumentUpsert: 'entity_document.upsert',
  entityDocumentRenew: 'entity_document.renew',
  entityDocumentDelete: 'entity_document.delete',
  entityDocumentUpload: 'entity_document.upload',
  entityDocumentDownload: 'entity_document.download',

  invoiceCreate: 'invoice.create',
  invoiceMarkPaid: 'invoice.mark_paid',
  invoiceDelete: 'invoice.delete',
  invoiceUpload: 'invoice.upload',
  invoiceDownload: 'invoice.download',

  fuelImportPreview: 'fuel.import.preview',
  fuelImportConfirm: 'fuel.import.confirm',
  fuelLinkTrip: 'fuel.link_trip',
  fuelDelete: 'fuel.delete',

  inventoryItemUpsert: 'inventory_item.upsert',
  inventoryItemDelete: 'inventory_item.delete',
  inventoryItemSetActive: 'inventory_item.set_active',
  inventoryMovementCreate: 'inventory_movement.create',
  inventoryMovementDelete: 'inventory_movement.delete',

  companySettingsUpdate: 'company_settings.update',
  alertSettingsUpdate: 'alert_settings.update',
  expenseCategoryUpsert: 'expense_category.upsert',
  expenseCategoryToggle: 'expense_category.toggle',
  expenseCategoryDelete: 'expense_category.delete',
  userRoleUpdate: 'user.role_update',
  restoreRecord: 'restore.record',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export const auditActionLabels: Record<AuditAction, string> = {
  [AUDIT_ACTIONS.authSignIn]: 'Inicio de sesión',
  [AUDIT_ACTIONS.authSignOut]: 'Cierre de sesión',

  [AUDIT_ACTIONS.tripCreate]: 'Viaje creado',
  [AUDIT_ACTIONS.tripUpdate]: 'Viaje actualizado',
  [AUDIT_ACTIONS.tripStatusUpdate]: 'Estado de viaje',
  [AUDIT_ACTIONS.tripEstimateUpdate]: 'Estimación de viaje',
  [AUDIT_ACTIONS.tripDelete]: 'Viaje eliminado',
  [AUDIT_ACTIONS.tripPdfRegister]: 'PDF de viaje registrado',
  [AUDIT_ACTIONS.tripPdfUpload]: 'Subida de PDF de viaje',
  [AUDIT_ACTIONS.tripPdfDownload]: 'Descarga de PDF de viaje',

  [AUDIT_ACTIONS.tripObservationUpsert]: 'Observación de viaje',
  [AUDIT_ACTIONS.tripObservationDelete]: 'Observación eliminada',
  [AUDIT_ACTIONS.tripDocumentAdd]: 'Documento de viaje',
  [AUDIT_ACTIONS.tripDocumentDelete]: 'Documento de viaje eliminado',
  [AUDIT_ACTIONS.tripBillingUpdate]: 'Facturación de viaje',
  [AUDIT_ACTIONS.tripExpenseUpsert]: 'Gasto de viaje',
  [AUDIT_ACTIONS.tripExpenseDelete]: 'Gasto de viaje eliminado',

  [AUDIT_ACTIONS.proformaCreate]: 'Proforma creada',
  [AUDIT_ACTIONS.proformaUpdate]: 'Proforma actualizada',
  [AUDIT_ACTIONS.proformaDelete]: 'Proforma eliminada',
  [AUDIT_ACTIONS.proformaUpload]: 'Subida de proforma',
  [AUDIT_ACTIONS.proformaDownload]: 'Descarga de proforma',

  [AUDIT_ACTIONS.arcorClientUpsert]: 'Cuenta de viaje',
  [AUDIT_ACTIONS.arcorClientDelete]: 'Cuenta de viaje eliminada',

  [AUDIT_ACTIONS.clientUpsert]: 'Cliente de facturación',
  [AUDIT_ACTIONS.clientDelete]: 'Cliente eliminado',

  [AUDIT_ACTIONS.vehicleUpsert]: 'Vehículo',
  [AUDIT_ACTIONS.vehicleDelete]: 'Vehículo eliminado',
  [AUDIT_ACTIONS.driverUpsert]: 'Chofer',
  [AUDIT_ACTIONS.driverDelete]: 'Chofer eliminado',

  [AUDIT_ACTIONS.entityDocumentUpsert]: 'Documento de entidad',
  [AUDIT_ACTIONS.entityDocumentRenew]: 'Renovación de documento',
  [AUDIT_ACTIONS.entityDocumentDelete]: 'Documento eliminado',
  [AUDIT_ACTIONS.entityDocumentUpload]: 'Subida de documento',
  [AUDIT_ACTIONS.entityDocumentDownload]: 'Descarga de documento',

  [AUDIT_ACTIONS.invoiceCreate]: 'Factura creada',
  [AUDIT_ACTIONS.invoiceMarkPaid]: 'Factura marcada pagada',
  [AUDIT_ACTIONS.invoiceDelete]: 'Factura eliminada',
  [AUDIT_ACTIONS.invoiceUpload]: 'Subida de factura',
  [AUDIT_ACTIONS.invoiceDownload]: 'Descarga de factura',

  [AUDIT_ACTIONS.fuelImportPreview]: 'Vista previa importación combustible',
  [AUDIT_ACTIONS.fuelImportConfirm]: 'Importación de combustible',
  [AUDIT_ACTIONS.fuelLinkTrip]: 'Combustible vinculado a viaje',
  [AUDIT_ACTIONS.fuelDelete]: 'Transacción de combustible eliminada',

  [AUDIT_ACTIONS.inventoryItemUpsert]: 'Artículo de inventario',
  [AUDIT_ACTIONS.inventoryItemDelete]: 'Artículo eliminado',
  [AUDIT_ACTIONS.inventoryItemSetActive]: 'Estado de artículo',
  [AUDIT_ACTIONS.inventoryMovementCreate]: 'Movimiento de inventario',
  [AUDIT_ACTIONS.inventoryMovementDelete]: 'Movimiento eliminado',

  [AUDIT_ACTIONS.companySettingsUpdate]: 'Configuración de empresa',
  [AUDIT_ACTIONS.alertSettingsUpdate]: 'Alertas de documentos',
  [AUDIT_ACTIONS.expenseCategoryUpsert]: 'Categoría de gasto',
  [AUDIT_ACTIONS.expenseCategoryToggle]: 'Categoría activada/desactivada',
  [AUDIT_ACTIONS.expenseCategoryDelete]: 'Categoría eliminada',
  [AUDIT_ACTIONS.userRoleUpdate]: 'Rol de usuario',
  [AUDIT_ACTIONS.restoreRecord]: 'Restauración desde papelera',
}

export const auditActionOptions = Object.entries(auditActionLabels).map(([value, label]) => ({
  value: value as AuditAction,
  label,
}))

export function getAuditActionLabel(action: string): string {
  return auditActionLabels[action as AuditAction] ?? action
}

export function getEntityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null
  switch (entityType) {
    case 'trip':
      return `/app/viajes/${entityId}`
    case 'vehicle':
      return `/app/flota/${entityId}`
    case 'driver':
      return `/app/choferes/${entityId}`
    case 'inventory_item':
      return `/app/inventario/${entityId}`
  }
  return null
}
