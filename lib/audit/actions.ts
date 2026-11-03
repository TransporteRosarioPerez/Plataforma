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
  tripAdjustment: 'trip.adjustment',
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
  fuelUpsert: 'fuel.upsert',

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

  treasuryImportConfirm: 'treasury.import.confirm',
  treasuryImportDelete: 'treasury.import.delete',
  treasuryTransactionCreate: 'treasury.transaction.create',
  treasuryTransactionClassify: 'treasury.transaction.classify',
  treasuryTransactionDelete: 'treasury.transaction.delete',
  treasuryInternalPair: 'treasury.transaction.internal_pair',
  treasuryRulesReapply: 'treasury.rules.reapply',
  treasuryRuleUpsert: 'treasury.rule.upsert',
  treasuryRuleToggle: 'treasury.rule.toggle',
  treasuryCategoryUpsert: 'treasury.category.upsert',
  treasuryCounterpartyUpsert: 'treasury.counterparty.upsert',
  treasuryConfigDelete: 'treasury.config.delete',
  treasuryAccountUpdate: 'treasury.account.update',
  treasuryChequeUpsert: 'treasury.cheque.upsert',
  treasuryChequeStatus: 'treasury.cheque.status',
  treasuryChequeDelete: 'treasury.cheque.delete',
  treasuryClosedMonthImport: 'treasury.import.closed_month',
  treasuryMonthClose: 'treasury.month.close',
  treasuryMonthReopen: 'treasury.month.reopen',
  treasuryCashCount: 'treasury.cash_count.create',
  treasuryCashCountDelete: 'treasury.cash_count.delete',
  treasuryForecastUpsert: 'treasury.forecast.upsert',
  treasuryForecastDelete: 'treasury.forecast.delete',
  treasuryReceivedChequeUpsert: 'treasury.received_cheque.upsert',
  treasuryReceivedChequeSettle: 'treasury.received_cheque.settle',
  treasuryReceivedChequeDelete: 'treasury.received_cheque.delete',

  crmRequestAccept: 'crm.request.accept',
  crmRequestDiscard: 'crm.request.discard',
  crmQuoteWon: 'crm.quote.won',
  crmQuoteLost: 'crm.quote.lost',
  crmQuoteDelete: 'crm.quote.delete',
  crmCompanyUpsert: 'crm.company.upsert',
  crmCompanyDelete: 'crm.company.delete',
  crmCompanyMerge: 'crm.company.merge',
  crmRateUpsert: 'crm.rate.upsert',
  crmProspectUpsert: 'crm.prospect.upsert',
  crmProspectImport: 'crm.prospect.import',
  crmProspectDelete: 'crm.prospect.delete',
  crmOutreachStart: 'crm.outreach.start',
  crmOutreachTemplate: 'crm.outreach.template',
  crmGmailConnect: 'crm.gmail.connect',
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
  [AUDIT_ACTIONS.tripAdjustment]: 'Ajuste de viaje',
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
  [AUDIT_ACTIONS.fuelUpsert]: 'Carga de combustible registrada',

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

  [AUDIT_ACTIONS.treasuryImportConfirm]: 'Tesorería: extracto importado',
  [AUDIT_ACTIONS.treasuryImportDelete]: 'Tesorería: importación eliminada',
  [AUDIT_ACTIONS.treasuryTransactionCreate]: 'Tesorería: movimiento cargado',
  [AUDIT_ACTIONS.treasuryTransactionClassify]: 'Tesorería: movimiento clasificado',
  [AUDIT_ACTIONS.treasuryTransactionDelete]: 'Tesorería: movimiento eliminado',
  [AUDIT_ACTIONS.treasuryInternalPair]: 'Tesorería: transferencia interna',
  [AUDIT_ACTIONS.treasuryRulesReapply]: 'Tesorería: reglas re-aplicadas',
  [AUDIT_ACTIONS.treasuryRuleUpsert]: 'Tesorería: regla',
  [AUDIT_ACTIONS.treasuryRuleToggle]: 'Tesorería: regla activada/desactivada',
  [AUDIT_ACTIONS.treasuryCategoryUpsert]: 'Tesorería: categoría',
  [AUDIT_ACTIONS.treasuryCounterpartyUpsert]: 'Tesorería: contraparte',
  [AUDIT_ACTIONS.treasuryConfigDelete]: 'Tesorería: configuración eliminada',
  [AUDIT_ACTIONS.treasuryAccountUpdate]: 'Tesorería: cuenta',
  [AUDIT_ACTIONS.treasuryChequeUpsert]: 'Tesorería: cheque',
  [AUDIT_ACTIONS.treasuryChequeStatus]: 'Tesorería: cheque anulado/reactivado',
  [AUDIT_ACTIONS.treasuryChequeDelete]: 'Tesorería: cheque eliminado',
  [AUDIT_ACTIONS.treasuryClosedMonthImport]: 'Tesorería: carga en mes cerrado',
  [AUDIT_ACTIONS.treasuryMonthClose]: 'Tesorería: mes cerrado',
  [AUDIT_ACTIONS.treasuryMonthReopen]: 'Tesorería: mes reabierto',
  [AUDIT_ACTIONS.treasuryCashCount]: 'Tesorería: arqueo de efectivo',
  [AUDIT_ACTIONS.treasuryCashCountDelete]: 'Tesorería: arqueo eliminado',
  [AUDIT_ACTIONS.treasuryForecastUpsert]: 'Tesorería: ítem de proyección',
  [AUDIT_ACTIONS.treasuryForecastDelete]: 'Tesorería: ítem de proyección eliminado',
  [AUDIT_ACTIONS.treasuryReceivedChequeUpsert]: 'Tesorería: cheque recibido',
  [AUDIT_ACTIONS.treasuryReceivedChequeSettle]: 'Tesorería: cheque recibido depositado/descontado',
  [AUDIT_ACTIONS.treasuryReceivedChequeDelete]: 'Tesorería: cheque recibido eliminado',

  [AUDIT_ACTIONS.crmRequestAccept]: 'CRM: pedido pasado al board',
  [AUDIT_ACTIONS.crmRequestDiscard]: 'CRM: pedido descartado',
  [AUDIT_ACTIONS.crmQuoteWon]: 'CRM: cotización ganada',
  [AUDIT_ACTIONS.crmQuoteLost]: 'CRM: cotización perdida',
  [AUDIT_ACTIONS.crmQuoteDelete]: 'CRM: cotización eliminada',
  [AUDIT_ACTIONS.crmCompanyUpsert]: 'CRM: empresa',
  [AUDIT_ACTIONS.crmCompanyDelete]: 'CRM: empresa eliminada',
  [AUDIT_ACTIONS.crmCompanyMerge]: 'CRM: empresas fusionadas',
  [AUDIT_ACTIONS.crmRateUpsert]: 'CRM: tarifa',
  [AUDIT_ACTIONS.crmProspectUpsert]: 'CRM: prospecto',
  [AUDIT_ACTIONS.crmProspectImport]: 'CRM: prospectos importados',
  [AUDIT_ACTIONS.crmProspectDelete]: 'CRM: prospectos eliminados',
  [AUDIT_ACTIONS.crmOutreachStart]: 'CRM: secuencia de mails iniciada',
  [AUDIT_ACTIONS.crmOutreachTemplate]: 'CRM: plantillas de prospección',
  [AUDIT_ACTIONS.crmGmailConnect]: 'CRM: Gmail conectado',
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
    case 'treasury_transaction':
    case 'treasury_import_batch':
      return '/app/tesoreria/movimientos'
    case 'treasury_cheque':
    case 'treasury_received_cheque':
      return '/app/tesoreria/cheques'
    case 'treasury_month_close':
    case 'treasury_cash_count':
      return '/app/tesoreria/cierres'
    case 'treasury_forecast_item':
      return '/app/tesoreria/proyeccion'
  }
  return null
}
