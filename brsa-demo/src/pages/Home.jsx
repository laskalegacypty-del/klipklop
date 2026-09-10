import { Link } from 'react-router-dom'
import { CalendarDays, Crown } from 'lucide-react'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'

export function Home() {
  const { world, topRider, eventById, rider, unpaidFines, payInvoice } = useDemo()
  const live = world.events.find((e) => e.status === 'live') || eventById('west-fest')
  const featured = world.events.find((e) => e.featured) || live
  const fines = rider ? unpaidFines(rider.id) : []

  return (
    <div>
      <PageHeader title="Barrel Racing South Africa" description={`${world.season} season`} />

      {rider && fines.length ? (
        <Card className="mb-5 border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle>You have a fine to pay</CardTitle>
            <CardDescription>
              {fines[0].label} — {rand(fines[0].amount)}. You cannot enter a show until this is paid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => payInvoice(fines[0].id, { fromWallet: false })}>
                Pay {rand(fines[0].amount)} now
              </Button>
              <Link to="/wallet">
                <Button variant="secondary">See what I owe</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : rider ? (
        <Card className="mb-5 border-brand-400 bg-brand-50">
          <CardHeader>
            <CardTitle>Hi {rider.name.split(' ')[0]}</CardTitle>
            <CardDescription>
              {live ? `${live.name} is on this weekend.` : 'Your next show will show here.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {live ? (
              <Link to={`/events/${live.id}?tab=enter`}>
                <Button size="lg">Enter this show</Button>
              </Link>
            ) : null}
            <Link to="/dashboard">
              <Button variant="secondary">My season</Button>
            </Link>
            <Link to="/barry">
              <Button variant="ghost">Ask Barry</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {live ? (
        <Card className="mb-5 overflow-hidden border-season">
          <div className="h-1.5 bg-season" />
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
            <div>
              <Badge variant="danger">Running today</Badge>
              <p className="mt-2 font-display text-2xl font-semibold">{live.name}</p>
              <p className="text-sm text-stone-600">
                {live.venue} · {live.runs === 2 ? 'two runs, best time counts' : 'one run'}
              </p>
            </div>
            <Link to={`/events/${live.id}`}>
              <Button>Open the flyer</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-5 overflow-hidden bg-charcoal text-brand-50 border-charcoal">
        <div className="h-1 bg-brand-400" />
        <div className="h-0.5 bg-season" />
        <CardContent className="flex flex-wrap items-center gap-4 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-sm bg-brand-400 font-display text-2xl font-bold text-charcoal">
            {world.sponsor.mark}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-brand-300">{world.sponsor.tag}</p>
            <p className="font-display text-3xl font-semibold">{world.sponsor.name}</p>
            <p className="text-sm text-stone-400">Official feed partner for the 2026/27 season.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard icon={Crown} label="Top rider right now" value={topRider?.name ?? '—'} hint={`${topRider?.points ?? 0} points`} />
        <StatCard icon={CalendarDays} label="Up next" value={featured?.name ?? '—'} hint={featured ? `${featured.date} · ${featured.venue}` : ''} />
      </div>
    </div>
  )
}
