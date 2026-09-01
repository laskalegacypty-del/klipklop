import { cn } from './cn'

export function Tabs({ tabs, activeTab, onChange, className }) {
  return (
    <div className={cn('flex gap-2 border-b border-dust-200 overflow-x-auto', className)}>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap',
            activeTab === id
              ? 'border-brand-600 text-brand-800'
              : 'border-transparent text-stone-500 hover:text-stone-700',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
