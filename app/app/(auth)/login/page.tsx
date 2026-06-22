import { Truck } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { APP_NAME } from '@/lib/brand'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4">
            <Truck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-center">{APP_NAME}</h1>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
