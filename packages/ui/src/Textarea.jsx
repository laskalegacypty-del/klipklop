import { forwardRef } from 'react'
import { cn } from './cn'

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn('kk-textarea', className)} {...props} />
})
