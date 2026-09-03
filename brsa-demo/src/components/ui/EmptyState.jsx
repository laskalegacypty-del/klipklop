import { cn } from './cn'

export function EmptyState({ title = 'Nothing here yet', description, action, className }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-dust-200 bg-white px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mx-auto mb-3 h-px w-10 bg-season" />
      <h3 className="font-display text-xl font-semibold text-charcoal">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-600">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
