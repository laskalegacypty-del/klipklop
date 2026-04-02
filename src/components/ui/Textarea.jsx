import { forwardRef } from 'react'
import { cn } from './cn'

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-28 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500',
        className,
      )}
      {...props}
    />
  )
})

