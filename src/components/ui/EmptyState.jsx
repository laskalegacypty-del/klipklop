import { cn } from './cn'

export function EmptyState({ title = 'Nothing here yet', description, action, className }) {
  return (
    <div className={cn('rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center', className)}>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

