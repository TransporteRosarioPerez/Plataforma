import type { ArcorClient, Driver, Vehicle } from '@/lib/types'

export type TripMasterPrerequisites = {
  canCreate: boolean
  missing: string[]
}

export function getTripMasterPrerequisites(
  arcorClients: ArcorClient[],
  vehicles: Vehicle[],
  drivers: Driver[]
): TripMasterPrerequisites {
  const hasArcorClient = arcorClients.length > 0
  const hasTruck = vehicles.some((v) => v.type === 'truck' && v.status === 'active')
  const hasTrailer = vehicles.some(
    (v) => (v.type === 'semi' || v.type === 'trailer') && v.status === 'active'
  )
  const hasDriver = drivers.some((d) => d.status === 'active')

  const missing: string[] = []
  if (!hasArcorClient) missing.push('Catálogo de clientes operativos (viajes)')
  if (!hasTruck) missing.push('Al menos un camión activo')
  if (!hasTrailer) missing.push('Al menos un semi o acoplado activo')
  if (!hasDriver) missing.push('Al menos un chofer activo')

  return {
    canCreate: missing.length === 0,
    missing,
  }
}
