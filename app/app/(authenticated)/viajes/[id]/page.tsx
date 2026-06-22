import { notFound } from 'next/navigation'
import { getTripById } from '@/lib/data/trips'
import { getTripDocuments } from '@/lib/data/trip-documents'
import { getTripObservations } from '@/lib/data/trip-observations'
import { getProformasByTripId } from '@/lib/data/proformas'
import { getInvoicesByTripId } from '@/lib/data/invoices'
import { getTripExpensesByTripId } from '@/lib/data/trip-expenses'
import { getExpenseCategories } from '@/lib/data/expense-categories'
import { TripDetailView } from '@/components/trips/trip-detail-view'

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [trip, documents, observations, proformas, invoices, expenses, expenseCategories] =
    await Promise.all([
      getTripById(id),
      getTripDocuments(id),
      getTripObservations(id),
      getProformasByTripId(id),
      getInvoicesByTripId(id),
      getTripExpensesByTripId(id),
      getExpenseCategories(),
    ])

  if (!trip) notFound()

  return (
    <TripDetailView
      trip={trip}
      documents={documents}
      observations={observations}
      proformas={proformas}
      invoices={invoices}
      expenses={expenses}
      expenseCategories={expenseCategories}
    />
  )
}
