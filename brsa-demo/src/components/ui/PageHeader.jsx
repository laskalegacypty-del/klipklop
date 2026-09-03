import { cn } from './cn'

export function PageHeader({ title, description, actions, className }) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-charcoal sm:text-4xl">
          {title}
        </h1>
        <span className="title-rule" aria-hidden="true" />
        {description ? <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
