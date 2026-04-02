import { forwardRef } from 'react'
import { cn } from './cn'

export const Select = forwardRef(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500',
        className,
      )}
      {...props}
    />
  )
})

