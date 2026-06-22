import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { DbCompanySettings } from '@/lib/db/mappers'

export const getCompanySettings = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .single()

  if (error) throw new Error(error.message)
  return data as DbCompanySettings
})
