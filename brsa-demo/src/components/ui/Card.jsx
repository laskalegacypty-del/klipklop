import { cn } from './cn'

export function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-2xl border border-dust-200 bg-white shadow-sm', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('border-b border-dust-100 px-4 py-4 sm:px-6', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('font-display text-lg font-semibold text-charcoal', className)} {...props} />
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('mt-1 text-sm text-stone-600', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-4 py-4 sm:px-6 sm:py-5', className)} {...props} />
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('border-t border-dust-100 px-4 py-4 sm:px-6', className)} {...props} />
}
