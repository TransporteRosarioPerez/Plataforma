'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type CompanyOption = { id: string; name: string; aliases?: string[] }

export function CompanyPicker({
  companies,
  value,
  onChange,
  placeholder = 'Buscar empresa…',
  excludeId,
}: {
  companies: CompanyOption[]
  value: string | null
  onChange: (id: string) => void
  placeholder?: string
  excludeId?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = companies.find((c) => c.id === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No hay empresas con ese nombre.</CommandEmpty>
            <CommandGroup>
              {companies
                .filter((c) => c.id !== excludeId)
                .map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${(c.aliases ?? []).join(' ')} ${c.id}`}
                    onSelect={() => {
                      onChange(c.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{c.name}</span>
                    {c.aliases?.length ? <span className="ml-2 truncate text-xs text-muted-foreground">({c.aliases.join(', ')})</span> : null}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
