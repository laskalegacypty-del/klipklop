import { cn } from './cn'

export function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-2xl border border-gray-200 bg-white shadow-sm', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('border-b border-gray-100 px-6 py-4', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return (
    <h3 className={cn('text-base font-semibold text-gray-900', className)} {...props} />
  )
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('mt-1 text-sm text-gray-600', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-6 py-5', className)} {...props} />
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('border-t border-gray-100 px-6 py-4', className)} {...props} />
}

