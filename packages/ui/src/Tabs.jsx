import { cn } from './cn'

export function Tabs({ tabs = [], activeTab, onChange, className }) {
  return (
    <div className={cn('kk-tabs', className)} role="tablist">
      {tabs.map((tab) => {
        const id = tab.id ?? tab
        const label = tab.label ?? tab
        const selected = activeTab === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn('kk-tab', selected && 'is-active')}
            onClick={() => onChange?.(id)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
