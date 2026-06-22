import type { DocumentEntityType } from '@/lib/types'

export const entityTypeLabels: Record<DocumentEntityType, string> = {
  vehicle: 'Flota',
  driver: 'Choferes',
  company: 'Empresa',
}

export const entityTypeOrder: DocumentEntityType[] = ['vehicle', 'driver', 'company']

export function groupByEntityType<T extends { entityType: DocumentEntityType | string }>(
  items: T[]
): Record<DocumentEntityType, T[]> {
  const groups: Record<DocumentEntityType, T[]> = {
    vehicle: [],
    driver: [],
    company: [],
  }
  for (const item of items) {
    const key = item.entityType as DocumentEntityType
    if (groups[key]) groups[key].push(item)
  }
  return groups
}
