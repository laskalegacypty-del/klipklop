import { cn } from './cn'

const variants = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-900',
  danger: 'bg-red-100 text-red-800',
  brand: 'bg-green-100 text-green-900',
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

