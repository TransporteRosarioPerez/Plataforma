import { getOutreachSetup } from '@/lib/crm/server/data-prospects'
import { OutreachTemplatesView } from '@/components/crm/outreach-templates-view'

export default async function CrmProspectosPlantillasPage() {
  const setup = await getOutreachSetup()
  return <OutreachTemplatesView {...setup} />
}
