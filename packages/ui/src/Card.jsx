import { cn } from './cn'

export function Card({ className, ...props }) {
  return <div className={cn('kk-card', className)} {...props} />
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('kk-card__header', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('kk-card__title', className)} {...props} />
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('kk-card__desc', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('kk-card__content', className)} {...props} />
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('kk-card__footer', className)} {...props} />
}
