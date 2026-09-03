import { Link, useParams } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'

export function RiderProfile() {
  const { riderId } = useParams()
  const { world, riderById, user, boostRider, officialStandings } = useDemo()
  const rider = riderById(riderId)
  if (!rider) return <p>Rider not found.</p>

  const horses = world.horses.filter((h) => h.riderId === rider.id)
  const fan = world.fans.find((f) => f.biggestFanOf === rider.id)
  const rank = officialStandings().findIndex((r) => r.id === rider.id) + 1
  const rodeos = world.entries
    .filter((e) => e.riderId === rider.id && e.paid)
    .map((e) => world.events.find((ev) => ev.id === e.eventId))
    .filter(Boolean)

  return (
    <div>
      <div className="mb-5 overflow-hidden rounded-xl bg-charcoal text-brand-50">
        <div className="h-1 bg-brand-400" />
        <div className="h-0.5 bg-season" />
        <div className="h-24 bg-gradient-to-br from-ink via-charcoal to-stone-900" />
        <div className="px-5 pb-5 -mt-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-sm bg-brand-400 font-display text-2xl font-bold text-charcoal">
            {rider.name.slice(0, 1)}
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-4xl font-semibold">{rider.name}</h1>
              <p className="mt-1 text-sm tracking-wide text-stone-400">
                {rider.sa} · {rider.class} · {rider.province}
              </p>
            </div>
            {user.role === 'fan' ? (
              <Button onClick={() => boostRider(rider.id, 50)}>Boost R50</Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Rank" value={`#${rank}`} />
        <StatCard label="Points" value={rider.points} />
        <StatCard label="LTE" value={rand(rider.lte)} />
        <StatCard label="Wallet" value={rand(rider.wallet)} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Barn</CardTitle>
            <CardDescription>Horses on this card</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {horses.map((h) => (
              <div key={h.id} className="rounded-md border border-dust-200 bg-dust-50 px-4 py-3">
                <p className="font-semibold">{h.name}</p>
                <p className="text-sm text-stone-600">
                  {h.sex} · {h.age}yo · LTE {rand(h.lte)} · rank {h.rank}
                  {h.futurity ? ' · Futurity' : ''}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>People around the card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-stone-500">Biggest Fan · </span>
              {fan ? fan.name : '—'}
            </p>
            <p>
              <span className="text-stone-500">Sponsors · </span>
              {rider.sponsors.length ? rider.sponsors.join(', ') : 'Open'}
            </p>
            <p className="text-stone-600">{rider.bio}</p>
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Rodeos</p>
              <ul className="mt-1 space-y-1">
                {rodeos.map((ev) => (
                  <li key={ev.id}>
                    <Link className="link-quiet underline" to={`/events/${ev.id}`}>
                      {ev.name}
                    </Link>{' '}
                    {ev.official ? <Badge variant="success">Official</Badge> : <Badge variant="warning">Live</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
