import { cn } from './cn'
import { Card, CardContent } from './Card'

export function StatCard({ label, value, icon: Icon, hint, className }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="flex items-center gap-4">
        {Icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-800">
            <Icon size={22} />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-gray-600">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}

