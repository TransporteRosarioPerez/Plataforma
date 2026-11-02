import { notFound } from 'next/navigation'
import { getCatalog, getCompanyDetail } from '@/lib/crm/server/data'
import { CompanyDetailView } from '@/components/crm/company-detail-view'

export default async function CrmEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [detail, catalog] = await Promise.all([getCompanyDetail(id), getCatalog()])
  if (!detail) notFound()
  return (
    <CompanyDetailView
      key={id}
      {...detail}
      companies={catalog.companies.map((c) => ({ id: c.id, name: c.name, aliases: catalog.aliases.filter((a) => a.companyId === c.id).map((a) => a.alias) }))}
    />
  )
}
