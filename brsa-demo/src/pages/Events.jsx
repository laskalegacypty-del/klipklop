import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { Badge } from '../components/ui/Badge'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'

export function Events() {
  const { world } = useDemo()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [region, setRegion] = useState('all')
  const [status, setStatus] = useState('all')
  const events = useMemo(() => {
    return [...world.events]
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((e) => {
        if (q && !`${e.name} ${e.venue}`.toLowerCase().includes(q.toLowerCase())) return false
        if (type !== 'all' && e.type !== type) return false
        if (region !== 'all' && e.region !== region) return false
        if (status === 'live' && e.status !== 'live') return false
        if (status === 'official' && !e.official) return false
        if (status === 'upcoming' && (e.official || e.status === 'live')) return false
        return true
      })
  }, [world.events, q, type, region, status])

  return (
    <div>
      <PageHeader title="Events" description="Mini-Qualifier · Jackpot · Rodeo" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="w-48" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-40">
          <option value="all">All types</option>
          {[...new Set(world.events.map((e) => e.type))].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={region} onChange={(e) => setRegion(e.target.value)} className="w-44">
          <option value="all">All regions</option>
          {[...new Set(world.events.map((e) => e.region))].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="all">All status</option>
          <option value="live">Live today</option>
          <option value="upcoming">Upcoming</option>
          <option value="official">Official</option>
        </Select>
      </div>
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
                      <Badge>{event.type}</Badge>
                      {event.status === 'live' ? (
                        <Badge variant="danger">Live today</Badge>
                      ) : event.official ? (
                        <Badge variant="success">Official</Badge>
                      ) : event.resultsPostedAt ? (
                        <Badge variant="warning">Unofficial</Badge>
                      ) : (
                        <Badge>Upcoming</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      {event.date} · {event.region} · {event.venue}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">Open flyer →</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
