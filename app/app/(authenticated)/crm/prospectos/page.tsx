import { getProspectsPageData } from '@/lib/crm/server/data-prospects'
import { ProspectsView } from '@/components/crm/prospects-view'

export const dynamic = 'force-dynamic'

export default async function CrmProspectosPage({ searchParams }: { searchParams: Promise<{ gmail?: string; msg?: string }> }) {
  const [data, sp] = await Promise.all([getProspectsPageData(), searchParams])
  const flash = sp.gmail === 'ok' ? { ok: true, msg: 'Gmail conectado' } : sp.gmail === 'error' ? { ok: false, msg: sp.msg ?? 'No se pudo conectar Gmail' } : null
  return <ProspectsView data={data} flash={flash} />
}
