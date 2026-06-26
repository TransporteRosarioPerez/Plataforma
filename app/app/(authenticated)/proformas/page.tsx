import { getProformas } from '@/lib/data/proformas'
import { getClients } from '@/lib/data/clients'
import { getTripsForProformas } from '@/lib/data/trips'
import { getInvoicesByProformaIds } from '@/lib/data/invoices'
import { ProformasView } from '@/components/proformas/proformas-view'
import { getSession } from '@/lib/auth/session'
import { canAccessInvoices } from '@/lib/auth/permissions'

export default async function ProformasPage() {
  const session = await getSession()
  const canViewInvoices = session ? canAccessInvoices(session.profile.role) : false
  const [proformas, clients, trips] = await Promise.all([
    getProformas(),
    getClients(),
    getTripsForProformas(),
  ])

  const invoicesByProformaId = await getInvoicesByProformaIds(proformas.map((p) => p.id))

  return (
    <ProformasView
      proformas={proformas}
      clients={clients}
      trips={trips}
      invoicesByProformaId={invoicesByProformaId}
      canViewInvoices={canViewInvoices}
    />
  )
}
