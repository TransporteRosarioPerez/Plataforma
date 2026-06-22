import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { TripExpense } from '@/lib/types'

type DbTripExpense = {
  id: string
  trip_id: string
  category_id: string | null
  category_name: string | null
  description: string | null
  amount: number
  paid_by: 'empresa' | 'chofer'
  expense_date: string
  created_at: string
}

function mapTripExpense(row: DbTripExpense): TripExpense {
  return {
    id: row.id,
    tripId: row.trip_id,
    categoryId: row.category_id ?? '',
    categoryName: row.category_name ?? undefined,
    description: row.description ?? undefined,
    amount: Number(row.amount),
    paidBy: row.paid_by,
    expenseDate: new Date(row.expense_date),
  }
}

export const getTripExpensesByTripId = cache(async (tripId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as DbTripExpense[]).map(mapTripExpense)
})
