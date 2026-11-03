'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  buildTemplateVars, missingVariables, renderTemplate, replySubject, TEMPLATE_VARIABLES,
  type OutreachRoute, type OutreachTemplate,
} from '@/lib/crm/prospecting'
import { saveOutreachRoute, saveOutreachTemplate } from '@/lib/crm/server/actions-prospects'
import { useAction } from './shared'

type Props = { routes: OutreachRoute[]; templates: OutreachTemplate[]; signature: string }

const SAMPLE = {
  companyName: 'Frutícola Ejemplo S.A.',
  contactName: 'Juan Pérez',
  province: 'Río Negro',
  city: 'Cipolletti',
  products: 'Peras y manzanas',
  hook: 'Vi que venden en el Mercado Central de Buenos Aires.',
}

export function OutreachTemplatesView({ routes, templates, signature }: Props) {
  const sampleRoute = routes.find((r) => r.key === 'alto_valle') ?? null
  const vars = buildTemplateVars(SAMPLE, sampleRoute, signature)
  const firstSubject = renderTemplate(templates.find((t) => t.sequence === 'vuelta' && t.step === 1)?.subject ?? '', vars)
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild><Link href="/app/crm/prospectos"><ArrowLeft className="mr-1 h-4 w-4" />Prospectos</Link></Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rutas de vuelta</CardTitle>
          <CardDescription>
            Qué día vuelven desde cada zona. Se usa en los mails como {'{dia_vuelta}'} (“volvemos los jueves”). Si lo dejás vacío, esa frase no aparece.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {routes.map((r) => <RouteRow key={r.key} route={r} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Variables</CardTitle>
          <CardDescription>Lo que va entre [[ ]] se omite si alguna variable de adentro está vacía.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
          {TEMPLATE_VARIABLES.map((v) => (
            <div key={v.key}><code className="rounded bg-muted px-1">{`{${v.key}}`}</code> <span className="text-muted-foreground">{v.help}</span></div>
          ))}
        </CardContent>
      </Card>

      {templates.filter((t) => t.sequence === 'vuelta').map((t) => (
        <TemplateCard key={t.id} template={t} vars={vars} firstSubject={firstSubject} />
      ))}
    </div>
  )
}

function RouteRow({ route }: { route: OutreachRoute }) {
  const { pending, run } = useAction()
  const [day, setDay] = useState(route.returnDay ?? '')
  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3">
      <div className="min-w-48 flex-1">
        <div className="text-sm font-medium">{route.label}</div>
        <div className="text-xs text-muted-foreground">{route.provinces.join(', ')}</div>
      </div>
      <Input className="w-full sm:w-56" placeholder="ej.: los jueves" value={day} onChange={(e) => setDay(e.target.value)} />
      <Button size="sm" variant="outline" disabled={pending || day === (route.returnDay ?? '')} onClick={() => run(() => saveOutreachRoute({ key: route.key, returnDay: day || null }))}>Guardar</Button>
    </div>
  )
}

function TemplateCard({ template, vars, firstSubject }: { template: OutreachTemplate; vars: Record<string, string>; firstSubject: string }) {
  const { pending, run } = useAction()
  const [f, setF] = useState({ subject: template.subject, body: template.body, delayDays: String(template.delayDays), isActive: template.isActive })
  const first = template.step === 1
  const dirty = f.subject !== template.subject || f.body !== template.body || f.delayDays !== String(template.delayDays) || f.isActive !== template.isActive
  const missing = missingVariables(`${f.subject}\n${f.body}`, { ...vars, gancho: '', dia_vuelta: '' }).filter((k) => !['gancho', 'dia_vuelta'].includes(k))
  return (
    <Card className={!f.isActive ? 'opacity-60' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-base">{first ? 'Mail 1 · primer contacto' : `Mail ${template.step} · seguimiento`}</CardTitle>
          {!first && (
            <>
              <div className="flex items-center gap-1 text-sm">
                día <Input className="h-8 w-16" type="number" min={1} max={90} value={f.delayDays} onChange={(e) => setF({ ...f, delayDays: e.target.value })} />
              </div>
              <label className="ml-auto flex items-center gap-2 text-sm"><Switch checked={f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} />Activo</label>
            </>
          )}
        </div>
        {!first && <CardDescription>Se manda en el mismo hilo si no respondieron. Días contados desde el primer mail.</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {first && <div className="space-y-1"><Label>Asunto</Label><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>}
          <div className="space-y-1"><Label>Texto</Label><Textarea rows={14} className="font-mono text-xs" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
          {missing.length > 0 && <p className="text-xs text-destructive">Variables desconocidas: {missing.join(', ')}</p>}
          <Button disabled={pending || !dirty} onClick={() => run(() => saveOutreachTemplate({ id: template.id, subject: f.subject, body: f.body, delayDays: Number(f.delayDays), isActive: f.isActive }))}>Guardar</Button>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground">Vista previa (ejemplo: Alto Valle)</Label>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="mb-2 border-b pb-2"><span className="text-muted-foreground">Asunto: </span><span className="font-medium">{first ? renderTemplate(f.subject, vars) : replySubject(firstSubject)}</span></div>
            <pre className="whitespace-pre-wrap font-sans">{renderTemplate(f.body, vars)}</pre>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
