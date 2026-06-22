import type { Client, Driver, Vehicle, Proforma, ProformaLineItem, Invoice } from '@/lib/types'

export type DbClient = {
  id: string
  name: string
  account_id: string | null
  legacy_id: string | null
  cuit: string | null
  address: string | null
  phone: string | null
  email: string | null
  contact_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type DbVehicle = {
  id: string
  plate: string
  brand: string
  model: string
  year: number
  type: 'truck' | 'semi' | 'trailer'
  status: 'active' | 'maintenance' | 'inactive'
  vtv_expiry: string | null
  ruta_expiry: string | null
  insurance_expiry: string | null
  created_at: string
  updated_at: string
}

export type DbDriver = {
  id: string
  name: string
  dni: string
  license_number: string | null
  license_expiry: string | null
  linti_expiry: string | null
  psychophysical_expiry: string | null
  art_expiry: string | null
  phone: string | null
  email: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export type DbCompanySettings = {
  id: string
  name: string
  cuit: string | null
  address: string | null
  logo_url: string | null
  alert_enabled: boolean
  alert_webhook_url: string | null
  alert_whatsapp_phones: string[]
  alert_days_before: number
}

export function mapClient(row: DbClient): Client {
  return {
    id: row.id,
    organizationId: '',
    name: row.name,
    accountId: row.account_id ?? undefined,
    cuit: row.cuit ?? undefined,
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    contactName: row.contact_name ?? undefined,
  }
}

export function mapVehicle(row: DbVehicle): Vehicle {
  return {
    id: row.id,
    organizationId: '',
    plate: row.plate,
    brand: row.brand,
    model: row.model,
    year: row.year,
    type: row.type,
    status: row.status,
    vtvExpiry: row.vtv_expiry ? new Date(row.vtv_expiry) : undefined,
    rutaExpiry: row.ruta_expiry ? new Date(row.ruta_expiry) : undefined,
    insuranceExpiry: row.insurance_expiry ? new Date(row.insurance_expiry) : undefined,
  }
}

export function mapDriver(row: DbDriver): Driver {
  return {
    id: row.id,
    organizationId: '',
    name: row.name,
    dni: row.dni,
    licenseNumber: row.license_number ?? '',
    licenseExpiry: row.license_expiry ? new Date(row.license_expiry) : new Date(),
    lintiExpiry: row.linti_expiry ? new Date(row.linti_expiry) : undefined,
    psychophysicalExpiry: row.psychophysical_expiry
      ? new Date(row.psychophysical_expiry)
      : undefined,
    artExpiry: row.art_expiry ? new Date(row.art_expiry) : undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    status: row.status,
  }
}

export type DbProformaLineItem = {
  id: string
  proforma_id: string
  trip_id: string
  amount: number
  taxes: number
  created_at: string
}

export function mapProformaLineItem(row: DbProformaLineItem) {
  return {
    id: row.id,
    proformaId: row.proforma_id,
    tripId: row.trip_id,
    amount: Number(row.amount),
    taxes: Number(row.taxes),
  }
}

export type DbProforma = {
  id: string
  proforma_number: string
  client_id: string | null
  client_name: string
  trip_ids: string[]
  subtotal: number
  taxes: number
  total: number
  file_name: string | null
  file_url: string | null
  status: 'pendiente' | 'facturada' | 'cobrada'
  received_date: string
  notes: string | null
  created_at: string
}

export function mapProforma(row: DbProforma, lineItems: ProformaLineItem[] = []): Proforma {
  return {
    id: row.id,
    organizationId: '',
    proformaNumber: row.proforma_number,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name,
    tripIds: row.trip_ids ?? [],
    lineItems,
    subtotal: Number(row.subtotal),
    taxes: Number(row.taxes),
    total: Number(row.total),
    fileName: row.file_name ?? undefined,
    fileUrl: row.file_url ?? undefined,
    status: row.status,
    receivedDate: new Date(row.received_date),
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

export type DbInvoice = {
  id: string
  invoice_number: string
  invoice_type: 'A' | 'B' | 'C'
  client_id: string | null
  client_name: string
  client_cuit: string | null
  proforma_id: string | null
  trip_ids: string[]
  subtotal: number
  iva: number
  total: number
  status: 'emitida' | 'cobrada' | 'anulada'
  issue_date: string
  paid_date: string | null
  file_name: string | null
  file_url: string | null
  created_at: string
}

export function mapInvoice(row: DbInvoice): Invoice {
  return {
    id: row.id,
    organizationId: '',
    invoiceNumber: row.invoice_number,
    invoiceType: row.invoice_type,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name,
    clientCuit: row.client_cuit ?? undefined,
    proformaId: row.proforma_id ?? undefined,
    tripIds: row.trip_ids ?? [],
    subtotal: Number(row.subtotal),
    iva: Number(row.iva),
    total: Number(row.total),
    status: row.status,
    issueDate: new Date(row.issue_date),
    paidDate: row.paid_date ? new Date(row.paid_date) : undefined,
    fileName: row.file_name ?? undefined,
    fileUrl: row.file_url ?? undefined,
    createdAt: new Date(row.created_at),
  }
}
