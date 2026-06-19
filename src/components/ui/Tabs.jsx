import { cn } from './cn'

export function Tabs({ tabs, activeTab, onChange, className }) {
  return (
    <div className={cn('flex gap-2 border-b border-gray-200 overflow-x-auto', className)}>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap',
            activeTab === id
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
