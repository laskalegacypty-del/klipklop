import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'

export function Feed() {
  const { world } = useDemo()
  const items = [...world.feed].sort((a, b) => new Date(b.at) - new Date(a.at))

  return (
    <div>
      <PageHeader title="News" description="Official notices, awards, birthdays. Rider posts live in Community." />
      {items.length === 0 ? (
        <EmptyState title="No notices yet" description="Official results and system notes will land here." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className={item.type === 'boost' || item.type === 'award' || item.type === 'birthday' ? 'border-season' : ''}>
              <CardContent>
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  {item.category || item.type} · {new Date(item.at).toLocaleString('en-ZA')}
                </p>
                <p className="mt-1 font-medium">{item.text}</p>
                {item.riderId ? (
                  <Link className="mt-1 inline-block text-sm underline" to={`/riders/${item.riderId}`}>
                    Open rider
                  </Link>
                ) : item.to ? (
                  <Link className="mt-1 inline-block text-sm underline" to={item.to}>
                    Open
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
