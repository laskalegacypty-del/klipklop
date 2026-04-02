import { forwardRef } from 'react'
import { cn } from './cn'

const styles = {
  base:
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white',
  variant: {
    primary: 'bg-green-800 text-white hover:bg-green-900',
    secondary: 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50',
    ghost: 'text-gray-700 hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  },
  size: {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-base',
  },
}

export const Button = forwardRef(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(styles.base, styles.variant[variant], styles.size[size], className)}
      {...props}
    />
  )
})

