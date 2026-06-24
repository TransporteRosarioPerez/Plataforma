import { notFound } from 'next/navigation'
import { getTripById } from '@/lib/data/trips'
import { getArcorClients } from '@/lib/data/arcor-clients'
import { getVehicles } from '@/lib/data/vehicles'
import { getDrivers } from '@/lib/data/drivers'
import { getTripDocuments } from '@/lib/data/trip-documents'
import { getTripObservations } from '@/lib/data/trip-observations'
import { getProformasByTripId } from '@/lib/data/proformas'
import { getInvoicesByTripId } from '@/lib/data/invoices'
import { getTripExpensesByTripId } from '@/lib/data/trip-expenses'
import { getFuelTransactionsByTripId } from '@/lib/data/fuel-transactions'
import { getExpenseCategories } from '@/lib/data/expense-categories'
import { TripDetailView } from '@/components/trips/trip-detail-view'
import { getSession } from '@/lib/auth/session'
import { canAccessInvoices } from '@/lib/auth/permissions'

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  const canViewInvoices = session ? canAccessInvoices(session.profile.role) : false
  const [trip, documents, observations, proformas, invoices, expenses, fuelTransactions, expenseCategories, arcorClients, vehicles, drivers] =
    await Promise.all([
      getTripById(id),
      getTripDocuments(id),
      getTripObservations(id),
      getProformasByTripId(id),
      getInvoicesByTripId(id),
      getTripExpensesByTripId(id),
      getFuelTransactionsByTripId(id),
      getExpenseCategories(),
      getArcorClients(),
      getVehicles(),
      getDrivers(),
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
      fuelTransactions={fuelTransactions}
      expenseCategories={expenseCategories}
      canViewInvoices={canViewInvoices}
      arcorClients={arcorClients}
      vehicles={vehicles}
      drivers={drivers}
    />
  )
}
