import { requireSuperadmin } from '@/lib/auth/session'
import { getInvoices } from '@/lib/data/invoices'
import { getProformas } from '@/lib/data/proformas'
import { FacturasView } from '@/components/facturas/facturas-view'

export default async function FacturasPage() {
  await requireSuperadmin()
  const [invoices, proformas] = await Promise.all([getInvoices(), getProformas()])

  const invoicedProformaIds = new Set(
    invoices.map((inv) => inv.proformaId).filter((id): id is string => !!id)
  )

  return (
    <FacturasView
      invoices={invoices}
      proformas={proformas}
      invoicedProformaIds={[...invoicedProformaIds]}
    />
  )
}
