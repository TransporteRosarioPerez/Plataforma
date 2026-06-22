import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { ExpenseCategory } from '@/lib/types'

type DbExpenseCategory = {
  id: string
  code: string
  name: string
  is_default: boolean
  is_active: boolean
  created_at: string
}

function mapRow(row: DbExpenseCategory): ExpenseCategory {
  return {
    id: row.id,
    organizationId: '',
    name: row.name,
    code: row.code,
    isDefault: row.is_default,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
  }
}

export const getExpenseCategories = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .is('deleted_at', null)
    .order('name')
  if (error) throw new Error(error.message)
  return (data as DbExpenseCategory[]).map(mapRow)
})
