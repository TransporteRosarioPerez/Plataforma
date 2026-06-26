import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotificationsBellSkeleton() {
  return (
    <Button variant="ghost" size="icon" className="relative" disabled aria-hidden>
      <Bell className="h-5 w-5 opacity-40" />
    </Button>
  )
}
