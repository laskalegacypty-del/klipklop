import { cn } from './cn'

const variants = {
  default: 'bg-stone-100 text-stone-800',
  success: 'bg-emerald-100 text-emerald-900',
  warning: 'bg-amber-100 text-amber-950',
  danger: 'bg-red-100 text-red-800',
  brand: 'bg-brand-100 text-brand-900',
  charcoal: 'bg-charcoal text-brand-100',
}

export function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
