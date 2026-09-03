import { cn } from './cn'

const variants = {
  default: 'bg-stone-100 text-stone-800',
  success: 'bg-charcoal text-brand-300',
  warning: 'bg-brand-50 text-charcoal border border-brand-400',
  danger: 'bg-red-800 text-white',
  brand: 'bg-brand-400 text-charcoal',
  charcoal: 'bg-charcoal text-brand-300 border border-brand-400/40',
  season: 'bg-season text-season-ink',
}

export function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-semibold tracking-wide',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
