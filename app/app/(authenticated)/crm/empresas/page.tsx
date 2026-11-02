import { getCompaniesWithStats } from '@/lib/crm/server/data'
import { CompaniesView } from '@/components/crm/companies-view'

export default async function CrmEmpresasPage() {
  const { rows, duplicates } = await getCompaniesWithStats()
  return <CompaniesView rows={rows} duplicates={duplicates} />
}
