import { requireSuperadmin } from '@/lib/auth/session'
import { getDeletedRecords } from '@/lib/data/deleted-records'
import { PapeleraView } from '@/components/papelera/papelera-view'

export default async function PapeleraPage() {
  await requireSuperadmin()
  const records = await getDeletedRecords()
  return <PapeleraView records={records} />
}
