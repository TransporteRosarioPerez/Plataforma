import { getDashboardStats, getSentTripsForDashboard } from '@/lib/data/dashboard'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { getSession } from '@/lib/auth/session'
import { canAccessReports } from '@/lib/auth/permissions'

export default async function DashboardPage() {
  const [stats, sentTrips, session] = await Promise.all([
    getDashboardStats(),
    getSentTripsForDashboard(10),
    getSession(),
  ])
  const canViewReports = session ? canAccessReports(session.profile.role) : false
  return (
    <DashboardView stats={stats} sentTrips={sentTrips} canViewReports={canViewReports} />
  )
}
