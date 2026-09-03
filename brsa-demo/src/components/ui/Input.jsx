import { forwardRef } from 'react'
import { cn } from './cn'

export const Input = forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-11 w-full rounded-md border border-dust-200 bg-white px-3 text-sm text-charcoal shadow-sm placeholder:text-stone-400',
        'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
        className,
      )}
      {...props}
    />
  )
})
