import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { Badge } from '../components/ui/Badge'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'

const typeTone = {
  Jackpot: 'season',
  Rodeo: 'charcoal',
  'Mini-Qualifier': 'default',
}

export function Events() {
  const { world } = useDemo()
  const events = [...world.events].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div>
      <PageHeader title="Events" description="Mini-Qualifier · Jackpot · Rodeo" />
      {events.length === 0 ? (
        <EmptyState title="No events listed" description="When the calendar is posted, it will show here." />
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <Link key={event.id} to={`/events/${event.id}`}>
              <Card className="group hover:border-brand-400 transition">
                <CardContent className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-semibold">{event.name}</h2>
                      <Badge variant={typeTone[event.type] ?? 'default'}>{event.type}</Badge>
                      {event.official ? (
                        <Badge variant="success">Official</Badge>
                      ) : event.resultsPostedAt ? (
                        <Badge variant="warning">Unofficial 7-day hold</Badge>
                      ) : (
                        <Badge>Upcoming</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      {event.date} · {event.region} · {event.venue}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-charcoal group-hover:text-season">Open flyer →</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
