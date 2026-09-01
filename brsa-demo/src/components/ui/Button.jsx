import { forwardRef } from 'react'
import { cn } from './cn'

const styles = {
  base:
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-dust-50',
  variant: {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-white text-charcoal border border-dust-200 hover:bg-dust-50',
    ghost: 'text-stone-700 hover:bg-dust-100',
    danger: 'bg-red-700 text-white hover:bg-red-800',
    charcoal: 'bg-charcoal text-brand-100 hover:bg-ink',
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
