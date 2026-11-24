import { cn } from './cn'

export function PageHeader({ title, description, actions, className }) {
  return (
    <header className={cn('kk-page-header', className)}>
      <div>
        <h1 className="kk-page-header__title">{title}</h1>
        {description ? <p className="kk-page-header__desc">{description}</p> : null}
      </div>
      {actions ? <div className="kk-page-header__actions">{actions}</div> : null}
    </header>
  )
}
