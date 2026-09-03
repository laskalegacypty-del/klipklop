import { cn } from './cn'

export function Tabs({ tabs, activeTab, onChange, className }) {
  return (
    <div className={cn('flex gap-1 border-b border-dust-200 overflow-x-auto', className)}>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap',
            activeTab === id
              ? 'border-b-[color:var(--season)] text-charcoal'
              : 'border-transparent text-stone-500 hover:text-charcoal',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
