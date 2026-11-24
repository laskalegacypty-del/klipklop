import { cn } from './cn'

const variants = {
  default: 'kk-badge--default',
  accent: 'kk-badge--accent',
  soft: 'kk-badge--soft',
  success: 'kk-badge--success',
  warning: 'kk-badge--warning',
  danger: 'kk-badge--danger',
}

export function Badge({ className, variant = 'default', ...props }) {
  return <span className={cn('kk-badge', variants[variant], className)} {...props} />
}
