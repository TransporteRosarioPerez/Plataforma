'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  deleteConfigItem,
  toggleRule,
  updateAccount,
  upsertCategory,
  upsertCounterparty,
  upsertRule,
  type TrashableEntity,
} from '@/lib/tesoreria/server/actions-config'
import type {
  TreasuryAccount,
  TreasuryCategory,
  TreasuryCategoryKind,
  TreasuryCounterparty,
  TreasuryRule,
  TreasuryRuleDirection,
  TreasuryRuleMatchType,
  TreasuryScope,
} from '@/lib/tesoreria/types'
import { formatGroupedNumber, parseGroupedNumber } from '@/lib/format/numbers'
import { formatDate, formatMoney, kindLabels, scopeLabels } from './format'

/** "-1.234,56" → -1234.56 (el input numérico común de la app no acepta negativos). */
function parseSignedAmount(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  const negative = trimmed.startsWith('-')
  const value = parseGroupedNumber(trimmed.replace(/-/g, ''))
  if (value === undefined) return undefined
  return negative ? -value : value
}

type ActionResult = { error?: string; success?: string }

function useAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    startTransition(async () => {
      const r = await fn()
      if (r.error) toast.error(r.error)
      else {
        toast.success(r.success)
        onOk?.()
        router.refresh()
      }
    })
  return { pending, run }
}

const NONE = '__none'

type Props = {
  initialTab: string
  accounts: TreasuryAccount[]
  categories: TreasuryCategory[]
  rules: TreasuryRule[]
  counterparties: TreasuryCounterparty[]
}

export function ConfigView({ initialTab, accounts, categories, rules, counterparties }: Props) {
  const router = useRouter()
  return (
    <Tabs
      defaultValue={initialTab}
      onValueChange={(v) => router.replace(`/app/tesoreria/configuracion?tab=${v}`, { scroll: false })}
    >
      <TabsList>
        <TabsTrigger value="cuentas">Cuentas</TabsTrigger>
        <TabsTrigger value="categorias">Categorías</TabsTrigger>
        <TabsTrigger value="reglas">Reglas</TabsTrigger>
        <TabsTrigger value="contrapartes">Contrapartes</TabsTrigger>
      </TabsList>
      <TabsContent value="cuentas" className="mt-4"><AccountsTab accounts={accounts} /></TabsContent>
      <TabsContent value="categorias" className="mt-4"><CategoriesTab categories={categories} /></TabsContent>
      <TabsContent value="reglas" className="mt-4"><RulesTab rules={rules} categories={categories} accounts={accounts} /></TabsContent>
      <TabsContent value="contrapartes" className="mt-4"><CounterpartiesTab counterparties={counterparties} categories={categories} /></TabsContent>
    </Tabs>
  )
}

function TrashButton({ entity, id, label }: { entity: TrashableEntity; id: string; label: string }) {
  const { pending, run } = useAction()
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      title="Enviar a la papelera"
      onClick={() => {
        if (window.confirm(`¿Enviar "${label}" a la papelera?`)) run(() => deleteConfigItem(entity, id))
      }}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  )
}

function ScopeSelect({ value, onChange, allowEmpty = true }: { value: TreasuryScope | null; onChange: (v: TreasuryScope | null) => void; allowEmpty?: boolean }) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : (v as TreasuryScope))}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value={NONE}>Según la categoría</SelectItem>}
        <SelectItem value="empresa">Empresa</SelectItem>
        <SelectItem value="personal">Personal</SelectItem>
      </SelectContent>
    </Select>
  )
}

function CategorySelect({ value, onChange, categories, placeholder }: { value: string | null; onChange: (v: string | null) => void; categories: TreasuryCategory[]; placeholder?: string }) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {placeholder && <SelectItem value={NONE}>{placeholder}</SelectItem>}
        {categories.filter((c) => c.isActive).map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name} <span className="ml-1 text-xs text-muted-foreground">{kindLabels[c.kind]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

function AccountsTab({ accounts }: { accounts: TreasuryAccount[] }) {
  const [editing, setEditing] = useState<TreasuryAccount | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuentas</CardTitle>
        <CardDescription>
          El saldo inicial es lo que había en la cuenta en la fecha de apertura. Con eso el sistema calcula el saldo y lo compara con el del banco.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Saldo inicial</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>{a.kind === 'bank' ? 'Banco' : a.kind === 'wallet' ? 'Billetera' : 'Efectivo'}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(a.openingBalance)}</TableCell>
                <TableCell>{formatDate(a.openingDate)}</TableCell>
                <TableCell>{a.isActive ? <Badge variant="secondary">Activa</Badge> : <Badge variant="outline">Inactiva</Badge>}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(a)}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <AccountDialog account={editing} onClose={() => setEditing(null)} />
    </Card>
  )
}

function AccountDialog({ account, onClose }: { account: TreasuryAccount | null; onClose: () => void }) {
  const { pending, run } = useAction()
  const [name, setName] = useState('')
  const [opening, setOpening] = useState('')
  const [openingDate, setOpeningDate] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!account) return
    setName(account.name)
    setOpening(formatGroupedNumber(account.openingBalance, { decimals: 2 }))
    setOpeningDate(account.openingDate ?? '')
    setIsActive(account.isActive)
  }, [account])

  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar cuenta</DialogTitle>
          <DialogDescription>
            Tip: usá como saldo inicial el saldo del banco el día anterior al primer movimiento que importaste.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Saldo inicial</Label>
              <Input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^\d.,-]/g, ''))} placeholder="-35.362,17" />
            </div>
            <div className="space-y-2"><Label>Fecha de apertura</Label><Input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={isActive} onCheckedChange={setIsActive} /> Cuenta activa</label>
          <p className="text-xs text-muted-foreground">Si la cuenta estaba en descubierto, poné el saldo con signo menos.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button
            disabled={pending}
            onClick={() =>
              account &&
              run(
                () => {
                  const value = parseSignedAmount(opening)
                  if (value === undefined) return Promise.resolve({ error: 'Saldo inicial inválido' })
                  return updateAccount({ id: account.id, name, openingBalance: value, openingDate: openingDate || null, isActive })
                },
                onClose
              )
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

type CategoryDraft = { id?: string; name: string; kind: TreasuryCategoryKind; defaultScope: TreasuryScope | null; isActive: boolean }

function CategoriesTab({ categories }: { categories: TreasuryCategory[] }) {
  const [draft, setDraft] = useState<CategoryDraft | null>(null)
  const { pending, run } = useAction()
  const groups: TreasuryCategoryKind[] = ['income', 'expense', 'internal']

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Categorías</CardTitle>
          <CardDescription>Cada categoría propone un ámbito (empresa o personal) que después se puede cambiar por movimiento.</CardDescription>
        </div>
        <Button onClick={() => setDraft({ name: '', kind: 'expense', defaultScope: 'empresa', isActive: true })}>
          <Plus className="mr-2 h-4 w-4" />Nueva
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((kind) => (
          <div key={kind} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{kind === 'income' ? 'Ingresos' : kind === 'expense' ? 'Egresos' : 'Internos (no suman)'}</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {categories.filter((c) => c.kind === kind).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={c.isActive ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>{c.name}</span>
                    {c.defaultScope && <Badge variant="outline">{scopeLabels[c.defaultScope]}</Badge>}
                  </div>
                  <div className="flex items-center">
                    <Switch
                      checked={c.isActive}
                      disabled={pending}
                      onCheckedChange={(v) => run(() => upsertCategory({ id: c.id, name: c.name, kind: c.kind, defaultScope: c.defaultScope, isActive: v }))}
                    />
                    <Button variant="ghost" size="icon" onClick={() => setDraft({ ...c })}><Pencil className="h-4 w-4" /></Button>
                    <TrashButton entity="category" id={c.id} label={c.name} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          {draft && (
            <>
              <DialogHeader><DialogTitle>{draft.id ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Nombre</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as TreasuryCategoryKind })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Ingreso</SelectItem>
                        <SelectItem value="expense">Egreso</SelectItem>
                        <SelectItem value="internal">Interno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {draft.kind !== 'internal' && (
                    <div className="space-y-2">
                      <Label>Ámbito por defecto</Label>
                      <ScopeSelect value={draft.defaultScope} onChange={(v) => setDraft({ ...draft, defaultScope: v })} />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDraft(null)} disabled={pending}>Cancelar</Button>
                <Button disabled={pending} onClick={() => run(() => upsertCategory(draft), () => setDraft(null))}>Guardar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------

type RuleDraft = {
  id?: string
  name: string
  matchType: TreasuryRuleMatchType
  pattern: string
  direction: TreasuryRuleDirection
  accountId: string | null
  categoryId: string | null
  scope: TreasuryScope | null
  transferAccountId: string | null
  priority: number
}

const matchLabels: Record<TreasuryRuleMatchType, string> = { contains: 'Contiene', regex: 'Expresión regular', cuit: 'CUIT' }
const directionLabels: Record<TreasuryRuleDirection, string> = { any: 'Ambos', in: 'Ingresos', out: 'Egresos' }

function RulesTab({ rules, categories, accounts }: { rules: TreasuryRule[]; categories: TreasuryCategory[]; accounts: TreasuryAccount[] }) {
  const [draft, setDraft] = useState<RuleDraft | null>(null)
  const { pending, run } = useAction()
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Reglas</CardTitle>
          <CardDescription>
            Se evalúan de menor a mayor prioridad y gana la primera que coincide. Las contrapartes por CUIT se evalúan antes que las reglas.
          </CardDescription>
        </div>
        <Button
          onClick={() =>
            setDraft({ name: '', matchType: 'contains', pattern: '', direction: 'out', accountId: null, categoryId: null, scope: null, transferAccountId: null, priority: 80 })
          }
        >
          <Plus className="mr-2 h-4 w-4" />Nueva
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Prior.</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Patrón</TableHead>
              <TableHead>Aplica a</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id} className={r.isActive ? undefined : 'opacity-50'}>
                <TableCell className="tabular-nums">{r.priority}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">{matchLabels[r.matchType]}: </span>
                  <code className="text-xs">{r.pattern}</code>
                </TableCell>
                <TableCell className="text-sm">
                  {directionLabels[r.direction]}
                  {r.accountId && <span className="text-muted-foreground"> · {accountName.get(r.accountId)}</span>}
                </TableCell>
                <TableCell className="text-sm">
                  {r.categoryId ? categoryName.get(r.categoryId) : '—'}
                  {r.scope && <span className="text-muted-foreground"> · {scopeLabels[r.scope]}</span>}
                  {r.transferAccountId && <span className="text-muted-foreground"> → {accountName.get(r.transferAccountId)}</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end">
                    <Switch checked={r.isActive} disabled={pending} onCheckedChange={(v) => run(() => toggleRule(r.id, v))} />
                    <Button variant="ghost" size="icon" onClick={() => setDraft({ ...r })}><Pencil className="h-4 w-4" /></Button>
                    <TrashButton entity="rule" id={r.id} label={r.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle>{draft.id ? 'Editar regla' : 'Nueva regla'}</DialogTitle>
                <DialogDescription>Las reglas nuevas se aplican a las próximas importaciones. Para los pendientes actuales usá “Re-aplicar reglas”.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Nombre</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={draft.matchType} onValueChange={(v) => setDraft({ ...draft, matchType: v as TreasuryRuleMatchType })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(matchLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Patrón</Label>
                    <Input value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} placeholder={draft.matchType === 'cuit' ? '30502793175' : 'Texto de la descripción'} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Movimientos</Label>
                    <Select value={draft.direction} onValueChange={(v) => setDraft({ ...draft, direction: v as TreasuryRuleDirection })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(directionLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cuenta</Label>
                    <Select value={draft.accountId ?? NONE} onValueChange={(v) => setDraft({ ...draft, accountId: v === NONE ? null : v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Todas</SelectItem>
                        {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridad</Label>
                    <Input type="number" min={0} max={1000} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <CategorySelect value={draft.categoryId} onChange={(v) => setDraft({ ...draft, categoryId: v })} categories={categories} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ámbito</Label>
                    <ScopeSelect value={draft.scope} onChange={(v) => setDraft({ ...draft, scope: v })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Crear espejo en otra cuenta (opcional)</Label>
                  <Select value={draft.transferAccountId ?? NONE} onValueChange={(v) => setDraft({ ...draft, transferAccountId: v === NONE ? null : v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No</SelectItem>
                      {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Ej.: una extracción de cajero se marca interna y entra a Efectivo.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDraft(null)} disabled={pending}>Cancelar</Button>
                <Button
                  disabled={pending}
                  onClick={() => {
                    if (!draft.categoryId) return toast.error('Elegí una categoría')
                    run(() => upsertRule({ ...draft, categoryId: draft.categoryId! }), () => setDraft(null))
                  }}
                >
                  Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Contrapartes
// ---------------------------------------------------------------------------

type CounterpartyDraft = { id?: string; cuit: string; name: string; categoryId: string | null; scope: TreasuryScope | null; notes: string }

function CounterpartiesTab({ counterparties, categories }: { counterparties: TreasuryCounterparty[]; categories: TreasuryCategory[] }) {
  const [draft, setDraft] = useState<CounterpartyDraft | null>(null)
  const { pending, run } = useAction()
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Contrapartes</CardTitle>
          <CardDescription>Clientes, proveedores, socios y personas por CUIT. Cada transferencia con ese CUIT se clasifica sola.</CardDescription>
        </div>
        <Button onClick={() => setDraft({ cuit: '', name: '', categoryId: null, scope: null, notes: '' })}><Plus className="mr-2 h-4 w-4" />Nueva</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>CUIT</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Ámbito</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {counterparties.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Se van agregando solas cuando clasificás un pendiente y elegís “Recordar el CUIT”.
                </TableCell>
              </TableRow>
            )}
            {counterparties.map((cp) => (
              <TableRow key={cp.id}>
                <TableCell className="font-medium">{cp.name}{cp.notes && <div className="text-xs font-normal text-muted-foreground">{cp.notes}</div>}</TableCell>
                <TableCell className="font-mono text-xs">{cp.cuit}</TableCell>
                <TableCell>{cp.categoryId ? categoryName.get(cp.categoryId) : '—'}</TableCell>
                <TableCell>{cp.scope ? scopeLabels[cp.scope] : 'Según la categoría'}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setDraft({ ...cp, notes: cp.notes ?? '' })}><Pencil className="h-4 w-4" /></Button>
                    <TrashButton entity="counterparty" id={cp.id} label={cp.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          {draft && (
            <>
              <DialogHeader><DialogTitle>{draft.id ? 'Editar contraparte' : 'Nueva contraparte'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>CUIT</Label><Input value={draft.cuit} onChange={(e) => setDraft({ ...draft, cuit: e.target.value.replace(/\D/g, '') })} placeholder="11 dígitos" /></div>
                  <div className="space-y-2"><Label>Nombre</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Categoría</Label><CategorySelect value={draft.categoryId} onChange={(v) => setDraft({ ...draft, categoryId: v })} categories={categories} placeholder="Sin categoría" /></div>
                  <div className="space-y-2"><Label>Ámbito</Label><ScopeSelect value={draft.scope} onChange={(v) => setDraft({ ...draft, scope: v })} /></div>
                </div>
                <div className="space-y-2"><Label>Notas</Label><Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDraft(null)} disabled={pending}>Cancelar</Button>
                <Button disabled={pending} onClick={() => run(() => upsertCounterparty(draft), () => setDraft(null))}>Guardar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
