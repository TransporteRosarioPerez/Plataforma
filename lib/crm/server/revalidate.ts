import 'server-only'
import { revalidatePath } from 'next/cache'

export function revalidateCrm() {
  revalidatePath('/app/crm', 'layout')
}
