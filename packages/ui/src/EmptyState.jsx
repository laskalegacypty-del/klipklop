import { cn } from './cn'

export function EmptyState({ title, description, action, className }) {
  return (
    <div className={cn('kk-empty', className)}>
      <h2 className="kk-empty__title">{title}</h2>
      {description ? <p className="kk-empty__desc">{description}</p> : null}
      {action || null}
    </div>
  )
}
