'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { ArcorClient } from '@/lib/types'

const LAST_ARCOR_CLIENT_KEY = 'remitolisto:last-arcor-client-id'

function sortArcorClients(clients: ArcorClient[]) {
  return [...clients].sort((a, b) => {
    const aNum = Number(a.accountId)
    const bNum = Number(b.accountId)
    if (a.accountId && b.accountId && !Number.isNaN(aNum) && !Number.isNaN(bNum)) {
      return aNum - bNum
    }
    if (a.accountId && !b.accountId) return -1
    if (!a.accountId && b.accountId) return 1
    return a.name.localeCompare(b.name, 'es')
  })
}

type ArcorClientComboboxProps = {
  clients: ArcorClient[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  name?: string
  allowAll?: boolean
  allLabel?: string
  autoSelectDefault?: boolean
}

export function ArcorClientCombobox({
  clients,
  value,
  onChange,
  disabled,
  name = 'client_id',
  allowAll = false,
  allLabel = 'Todos los clientes',
  autoSelectDefault = true,
}: ArcorClientComboboxProps) {
  const [open, setOpen] = useState(false)
  const sortedClients = useMemo(() => sortArcorClients(clients), [clients])

  useEffect(() => {
    if (!autoSelectDefault || allowAll || value || clients.length === 0) return
    const stored = localStorage.getItem(LAST_ARCOR_CLIENT_KEY)
    if (stored && clients.some((c) => c.id === stored)) {
      onChange(stored)
      return
    }
    onChange(clients[0].id)
  }, [autoSelectDefault, allowAll, clients, value, onChange])

  useEffect(() => {
    if (!allowAll && value && value !== 'all') {
      localStorage.setItem(LAST_ARCOR_CLIENT_KEY, value)
    }
  }, [allowAll, value])

  const selected = useMemo(
    () => sortedClients.find((client) => client.id === value),
    [sortedClients, value]
  )

  const label =
    allowAll && value === 'all'
      ? allLabel
      : selected
        ? `${selected.accountId ? `${selected.accountId} — ` : ''}${selected.name}`
        : 'Seleccionar cliente'

  return (
    <>
      {!allowAll ? <input type="hidden" name={name} value={value} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar por nº de cuenta o nombre..." />
            <CommandList>
              <CommandEmpty>Sin resultados</CommandEmpty>
              <CommandGroup>
                {allowAll && (
                  <CommandItem
                    value="todos los clientes"
                    onSelect={() => {
                      onChange('all')
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === 'all' ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {allLabel}
                  </CommandItem>
                )}
                {sortedClients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.accountId ?? ''} ${client.name} ${client.address ?? ''}`}
                    onSelect={() => {
                      onChange(client.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === client.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="min-w-0">
                      <div className="truncate">
                        {client.accountId ? (
                          <>
                            <span className="font-semibold tabular-nums">{client.accountId}</span>
                            <span> — {client.name}</span>
                          </>
                        ) : (
                          client.name
                        )}
                      </div>
                      {client.address && (
                        <div className="text-xs text-muted-foreground truncate">{client.address}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}
