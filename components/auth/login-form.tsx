'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { signIn } from '@/lib/actions/auth'
import type { ActionState } from '@/lib/validations/parse-form'

const initialState: ActionState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl">Iniciar sesión</CardTitle>
        <CardDescription>Ingresá tus credenciales para acceder a tu cuenta</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                required
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  required
                  disabled={pending}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <>
                  <Spinner className="mr-2" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </FieldGroup>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Usá un usuario creado en Supabase Auth. Contactá al administrador si no tenés acceso.
        </p>
      </CardContent>
    </Card>
  )
}
