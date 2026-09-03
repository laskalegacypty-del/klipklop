import { Link } from 'react-router-dom'
import { CalendarDays, Crown, Megaphone } from 'lucide-react'
import { useDemo } from '../demo/store'
import { roleLabel } from '../demo/world'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'

export function Home() {
  const { world, rider, topRider, eventById } = useDemo()
  const upcoming = eventById('west-fest')

  return (
    <div>
      <PageHeader
        title="Season desk"
        description={`${world.season} · ${world.accent?.name ?? 'Season accent'} · July–June · ${
          world.membershipIncludesApp ? 'App included in BRSA membership' : 'App billed as a separate sub'
        }`}
        actions={<Badge variant="season">{world.accent?.name}</Badge>}
      />

      <Card className="mb-5 overflow-hidden bg-charcoal text-brand-50 border-charcoal">
        <div className="h-1 bg-brand-400" />
        <div className="h-0.5 bg-season" />
        <CardContent className="flex flex-wrap items-center gap-4 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-sm bg-brand-400 font-display text-2xl font-bold text-charcoal">
            {world.sponsor.mark}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-brand-300">{world.sponsor.tag}</p>
            <p className="font-display text-3xl font-semibold">{world.sponsor.name}</p>
            <p className="text-sm text-stone-400">Official feed partner for the 2026/27 season.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={Crown}
          label="Top Rider"
          value={topRider?.name ?? '—'}
          hint={`${topRider?.points ?? 0} pts · ${topRider?.province ?? ''}`}
        />
        <StatCard
          icon={CalendarDays}
          label="Up next"
          value={upcoming?.name ?? '—'}
          hint={upcoming ? `${upcoming.date} · ${upcoming.venue}` : ''}
        />
        <StatCard
          icon={Megaphone}
          label="Your chip"
          value={
            rider?.membershipNote ||
            roleLabel(world.users.find((u) => u.id === world.currentUserId)?.role) ||
            'Guest'
          }
          hint={rider ? `${rider.sa} · ${rider.class}` : 'Federation desk'}
        />
      </div>

      {rider ? (
        <Card className="mt-5 border-brand-400 bg-brand-50">
          <CardHeader>
            <CardTitle>Membership</CardTitle>
            <CardDescription>
              {rider.membershipNote}. Unpaid fines still block the next entry — check invoices before West Fest.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link to="/invoices">
              <Button>Open invoices</Button>
            </Link>
            <Link to={`/events/${upcoming.id}`}>
              <Button variant="secondary">West Fest flyer</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-charcoal">This weekend: {upcoming.name}</p>
              <p className="text-sm text-stone-600">
                {upcoming.official ? (
                  <Badge variant="success">Official</Badge>
                ) : (
                  <Badge variant="warning">Results unofficial</Badge>
                )}{' '}
                {upcoming.venue}
              </p>
            </div>
            <Link to={`/events/${upcoming.id}`}>
              <Button>Open event</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
