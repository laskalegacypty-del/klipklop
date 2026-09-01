import { forwardRef } from 'react'
import { cn } from './cn'

export const Select = forwardRef(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-charcoal shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        className,
      )}
      {...props}
    />
  )
})
