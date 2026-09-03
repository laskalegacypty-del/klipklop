import { useDemo } from '../demo/store'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'

export function Feed() {
  const { world } = useDemo()
  const items = [...world.feed].sort((a, b) => new Date(b.at) - new Date(a.at))

  return (
    <div>
      <PageHeader title="News" description="Official notices. Rider posts live in Community." />
      {items.length === 0 ? (
        <EmptyState title="No notices yet" description="Official results and system notes will land here." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className={item.type === 'boost' ? 'border-season' : ''}>
              <CardContent>
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  {item.type} · {new Date(item.at).toLocaleString('en-ZA')}
                </p>
                <p className="mt-1 font-medium">{item.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
