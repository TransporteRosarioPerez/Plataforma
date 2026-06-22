import { getCompanySettings } from '@/lib/data/company'
import { getEntityDocuments, getEntityDocumentHistory } from '@/lib/data/documents'
import { EmpresaConfigView } from '@/components/config/empresa-config-view'

export default async function ConfiguracionEmpresaPage() {
  const company = await getCompanySettings()
  const [allDocs, companyDocumentHistory] = await Promise.all([
    getEntityDocuments(),
    getEntityDocumentHistory(company.id, 'company'),
  ])
  const companyDocs = allDocs.filter(
    (d) => d.entityType === 'company' && d.entityId === company.id
  )

  return (
    <EmpresaConfigView
      company={company}
      companyDocuments={companyDocs}
      companyDocumentHistory={companyDocumentHistory}
    />
  )
}
