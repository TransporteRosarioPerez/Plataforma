import { getProformas } from '@/lib/data/proformas'
import { getClients } from '@/lib/data/clients'
import { getTrips } from '@/lib/data/trips'
import { getInvoicesByProformaIds } from '@/lib/data/invoices'
import { ProformasView } from '@/components/proformas/proformas-view'

export default async function ProformasPage() {
  const [proformas, clients, trips] = await Promise.all([
    getProformas(),
    getClients(),
    getTrips(),
  ])

  const invoicesByProformaId = await getInvoicesByProformaIds(proformas.map((p) => p.id))

  return (
    <ProformasView
      proformas={proformas}
      clients={clients}
      trips={trips}
      invoicesByProformaId={invoicesByProformaId}
    />
  )
}
