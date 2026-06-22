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

type ArcorClientComboboxProps = {
  clients: ArcorClient[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  name?: string
}

export function ArcorClientCombobox({
  clients,
  value,
  onChange,
  disabled,
  name = 'client_id',
}: ArcorClientComboboxProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (value || clients.length === 0) return
    const stored = localStorage.getItem(LAST_ARCOR_CLIENT_KEY)
    if (stored && clients.some((c) => c.id === stored)) {
      onChange(stored)
      return
    }
    onChange(clients[0].id)
  }, [clients, value, onChange])

  useEffect(() => {
    if (value) localStorage.setItem(LAST_ARCOR_CLIENT_KEY, value)
  }, [value])

  const selected = useMemo(
    () => clients.find((client) => client.id === value),
    [clients, value]
  )

  const label = selected
    ? `${selected.accountId ? `${selected.accountId} — ` : ''}${selected.name}`
    : 'Seleccionar cliente'

  return (
    <>
      <input type="hidden" name={name} value={value} />
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
            <CommandInput placeholder="Buscar cliente..." />
            <CommandList>
              <CommandEmpty>Sin resultados</CommandEmpty>
              <CommandGroup>
                {clients.map((client) => (
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
                        {client.accountId ? `${client.accountId} — ` : ''}
                        {client.name}
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
