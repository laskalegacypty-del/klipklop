import { cn } from './cn'
import { Card, CardContent } from './Card'

export function StatCard({ label, value, icon: Icon, hint, className }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex">
        <div className="w-[3px] shrink-0 bg-season" />
        <CardContent className="flex flex-1 items-center gap-4">
          {Icon ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-charcoal text-brand-400">
              <Icon size={20} />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-charcoal">{value}</p>
            {hint ? <p className="mt-1 text-xs text-stone-600">{hint}</p> : null}
          </div>
        </CardContent>
      </div>
    </Card>
  )
}
