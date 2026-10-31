import { getAccounts, getCategories, getImportBatches } from '@/lib/tesoreria/server/data'
import { ImportarView } from '@/components/tesoreria/importar-view'

export default async function ImportarPage() {
  const [accounts, categories, batches] = await Promise.all([
    getAccounts(),
    getCategories(),
    getImportBatches(),
  ])
  return <ImportarView accounts={accounts} categories={categories} batches={batches} />
}
