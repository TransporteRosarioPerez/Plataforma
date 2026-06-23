import { requireSuperadmin } from '@/lib/auth/session'

export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSuperadmin()
  return children
}
