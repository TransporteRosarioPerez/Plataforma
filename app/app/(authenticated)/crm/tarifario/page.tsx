import { getRates } from '@/lib/crm/server/data'
import { RatesView } from '@/components/crm/rates-view'

export default async function CrmTarifarioPage() {
  const rates = await getRates()
  return <RatesView rates={rates} />
}
