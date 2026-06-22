import { notFound, redirect } from 'next/navigation'
import { INVENTORY_ENABLED } from '@/lib/features'
import { getInventoryItemById, getInventoryItems } from '@/lib/data/inventory-items'
import { getInventoryMovementsByItemId } from '@/lib/data/inventory-movements'
import { ItemDetailView } from '@/components/inventario/item-detail-view'

type ItemDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function InventarioItemPage({ params }: ItemDetailPageProps) {
  if (!INVENTORY_ENABLED) {
    redirect('/app/dashboard')
  }

  const { id } = await params

  const [item, movements, allItems] = await Promise.all([
    getInventoryItemById(id),
    getInventoryMovementsByItemId(id),
    getInventoryItems(),
  ])

  if (!item) notFound()

  return <ItemDetailView item={item} movements={movements} allItems={allItems} />
}
