'use client'

import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type FormSheetSize = 'narrow' | 'default' | 'wide'

const sizeClasses: Record<FormSheetSize, string> = {
  narrow: 'w-full max-w-full sm:max-w-md md:max-w-lg',
  default: 'w-full max-w-full sm:max-w-xl md:max-w-2xl',
  wide: 'w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl',
}

export type FormSheetStep = {
  id: string | number
  label: string
}

type FormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  size?: FormSheetSize
  steps?: FormSheetStep[]
  currentStep?: string | number
  footer?: ReactNode
  children: ReactNode
  className?: string
}

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  size = 'default',
  steps,
  currentStep,
  footer,
  children,
  className,
}: FormSheetProps) {
  const activeStepIndex = steps?.findIndex((s) => s.id === currentStep) ?? -1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex h-full max-h-[100dvh] flex-col gap-0 p-0',
          sizeClasses[size],
          className
        )}
      >
        <SheetHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
          {steps && steps.length > 0 && (
            <div className="flex items-center gap-2 pt-3">
              {steps.map((step, index) => {
                const isActive = step.id === currentStep
                const isDone = activeStepIndex >= 0 && index < activeStepIndex
                return (
                  <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isDone
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {index + 1}
                    </div>
                    <span
                      className={cn(
                        'truncate text-xs',
                        isActive ? 'font-medium' : 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </span>
                    {index < steps.length - 1 && (
                      <div className="mx-1 h-px min-w-2 flex-1 bg-border" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <SheetFooter className="shrink-0 border-t bg-muted/20 px-6 py-4 sm:flex-col">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
