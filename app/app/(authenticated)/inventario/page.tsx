import { redirect } from 'next/navigation'
import { INVENTORY_ENABLED } from '@/lib/features'
import { getInventoryItems } from '@/lib/data/inventory-items'
import { getInventoryCategories } from '@/lib/data/inventory-categories'
import { getInventoryPurchaseTotalInRange } from '@/lib/data/inventory-movements'
import { InventarioView } from '@/components/inventario/inventario-view'

export default async function InventarioPage() {
  if (!INVENTORY_ENABLED) {
    redirect('/app/dashboard')
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [items, categories, purchaseTotalMonth] = await Promise.all([
    getInventoryItems(),
    getInventoryCategories(),
    getInventoryPurchaseTotalInRange(monthStart, monthEnd),
  ])

  return (
    <InventarioView
      items={items}
      categories={categories}
      purchaseTotalMonth={purchaseTotalMonth}
    />
  )
}
