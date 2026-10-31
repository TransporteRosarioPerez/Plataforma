import 'server-only'
import { revalidatePath } from 'next/cache'

export function revalidateTreasury() {
  revalidatePath('/app/tesoreria', 'layout')
}
