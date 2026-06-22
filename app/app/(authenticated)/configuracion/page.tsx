'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Bell, ChevronRight, Receipt } from 'lucide-react'

const configSections = [
  {
    title: 'Categorías de Gastos',
    description: 'Administrá las categorías para clasificar los gastos de viaje',
    href: '/app/configuracion/gastos',
    icon: Receipt,
  },
  {
    title: 'Datos de la Empresa',
    description: 'Razón social, CUIT, domicilio y documentación de la empresa',
    href: '/app/configuracion/empresa',
    icon: Building2,
  },
  {
    title: 'Notificaciones',
    description: 'Alertas de vencimientos por WhatsApp',
    href: '/app/configuracion/notificaciones',
    icon: Bell,
  },
]

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configuración</h1>
        <p className="text-muted-foreground">
          Administrá la configuración de tu empresa
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {configSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <section.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center justify-between">
                    {section.title}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription>{section.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
