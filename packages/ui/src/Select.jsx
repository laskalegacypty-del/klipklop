import { forwardRef } from 'react'
import { cn } from './cn'

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn('kk-select', className)} {...props}>
      {children}
    </select>
  )
})
