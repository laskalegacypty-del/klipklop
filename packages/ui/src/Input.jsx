import { forwardRef } from 'react'
import { cn } from './cn'

export const Input = forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return <input ref={ref} type={type} className={cn('kk-input', className)} {...props} />
})
