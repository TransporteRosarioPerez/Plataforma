import { getExpenseCategories } from '@/lib/data/expense-categories'
import { GastosConfigView } from '@/components/config/gastos-config-view'

export default async function ConfiguracionGastosPage() {
  const categories = await getExpenseCategories()
  return <GastosConfigView categories={categories} />
}
