import { getDeletedRecords } from '@/lib/data/deleted-records'
import { PapeleraView } from '@/components/papelera/papelera-view'

export default async function PapeleraPage() {
  const records = await getDeletedRecords()
  return <PapeleraView records={records} />
}
