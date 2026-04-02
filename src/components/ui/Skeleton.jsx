import { cn } from './cn'

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-gray-200/70', className)}
      {...props}
    />
  )
}

