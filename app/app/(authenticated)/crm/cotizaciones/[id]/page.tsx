import { notFound } from 'next/navigation'
import { getCatalog, getQuote, getRates } from '@/lib/crm/server/data'
import { QuoteDetailView } from '@/components/crm/quote-detail-view'

export default async function CrmQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [data, catalog, rates] = await Promise.all([getQuote(id), getCatalog(), getRates()])
  if (!data) notFound()
  return (
    <QuoteDetailView
      key={`${data.quote.id}-${data.quote.stage}-${data.quote.quotedAmount}-${data.quote.companyId}`}
      quote={data.quote}
      events={data.events}
      request={data.request}
      companies={catalog.companies.map((c) => ({ id: c.id, name: c.name }))}
      contacts={catalog.contacts}
      rates={rates}
    />
  )
}
