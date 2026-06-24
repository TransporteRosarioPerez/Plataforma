'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  formatGroupedNumber,
  formatGroupedNumberInput,
  parseGroupedNumber,
} from '@/lib/format/numbers'

type NumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'inputMode'
> & {
  name?: string
  decimals?: number
  min?: number
  defaultValue?: number | string
  value?: number | string
  onValueChange?: (value: number | undefined) => void
}

function toDisplayValue(value: number | string | undefined, decimals: number) {
  if (value === undefined || value === '') return ''
  const numeric = typeof value === 'number' ? value : parseGroupedNumber(String(value))
  if (numeric === undefined) return String(value)
  return formatGroupedNumber(numeric, { decimals })
}

export function NumberInput({
  name,
  decimals = 0,
  min,
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  disabled,
  required,
  onBlur,
  onFocus,
  onWheel,
  ...props
}: NumberInputProps) {
  const isControlled = controlledValue !== undefined
  const [display, setDisplay] = React.useState(() => toDisplayValue(defaultValue, decimals))
  const [focused, setFocused] = React.useState(false)

  React.useEffect(() => {
    if (!isControlled || focused) return
    setDisplay(toDisplayValue(controlledValue, decimals))
  }, [controlledValue, decimals, focused, isControlled])

  const parsed = parseGroupedNumber(display)
  const submitValue = parsed ?? ''

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    if (parsed !== undefined) {
      const raw = decimals > 0 ? String(parsed).replace('.', ',') : String(parsed)
      setDisplay(raw)
    }
    onFocus?.(event)
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false)
    setDisplay(formatGroupedNumberInput(display, { decimals }))
    onBlur?.(event)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setDisplay(next)
    onValueChange?.(parseGroupedNumber(next))
  }

  const handleWheel = (event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur()
    onWheel?.(event)
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={submitValue} required={required} /> : null}
      <Input
        {...props}
        type="text"
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        value={display}
        disabled={disabled}
        className={cn(className)}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onWheel={handleWheel}
        aria-valuemin={min}
      />
    </>
  )
}
