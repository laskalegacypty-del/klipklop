import { forwardRef } from 'react'
import { cn } from './cn'

const styles = {
  base:
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-dust-50',
  variant: {
    primary: 'bg-brand-400 text-charcoal hover:bg-brand-300',
    secondary: 'bg-white text-charcoal border border-dust-200 hover:border-brand-400 hover:bg-brand-50',
    ghost: 'text-stone-700 hover:bg-brand-50 hover:text-charcoal',
    danger: 'bg-red-800 text-white hover:bg-red-900',
    charcoal: 'bg-charcoal text-brand-300 hover:bg-ink hover:text-brand-200',
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
