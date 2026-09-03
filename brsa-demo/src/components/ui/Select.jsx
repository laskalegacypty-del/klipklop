import { forwardRef } from 'react'
import { cn } from './cn'

export const Select = forwardRef(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full rounded-md border border-dust-200 bg-white px-3 text-sm text-charcoal shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
        className,
      )}
      {...props}
    />
  )
})
