import type { RestorableEntity } from '@/lib/actions/restore'

export type DeletedRecordRow = {
  id: string
  entity: RestorableEntity
  label: string
  deletedAt: Date
  context?: {
    tripId?: string
    entityType?: string
    entityId?: string
    itemId?: string
  }
}
