import { getCatalog, getInbox } from '@/lib/crm/server/data'
import { InboxView } from '@/components/crm/inbox-view'

export default async function CrmBandejaPage() {
  const [{ pending, recent }, catalog] = await Promise.all([getInbox(), getCatalog()])
  const companies = catalog.companies.map((c) => ({
    id: c.id,
    name: c.name,
    aliases: catalog.aliases.filter((a) => a.companyId === c.id).map((a) => a.alias),
  }))
  const companyNames = Object.fromEntries(catalog.companies.map((c) => [c.id, c.name]))
  return <InboxView pending={pending} recent={recent} companies={companies} companyNames={companyNames} />
}
