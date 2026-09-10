import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand, showsAttended } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { StatCard } from '../components/ui/StatCard'

export function RiderProfile() {
  const { riderId } = useParams()
  const { world, riderById, user, rider, boostRider, payRiderDirect, officialStandings, saveProfile, registerHorse, toggleFollow } = useDemo()
  const card = riderById(riderId)
  const [bio, setBio] = useState(card?.bio ?? '')
  if (!card) return <p>Rider not found.</p>

  const horses = world.horses.filter((h) => h.riderId === card.id)
  const fan = world.fans.find((f) => f.biggestFanOf === card.id)
  const rank = officialStandings().findIndex((r) => r.id === card.id) + 1
  const shows = showsAttended(world.entries.filter((e) => e.paid), card.id)
  const mine = rider?.id === card.id
  const who = rider?.id || world.users.find((u) => u.id === world.currentUserId)?.fanId
  const following = world.follows?.[who] ?? []
  const results = world.results.filter((r) => r.riderId === card.id && r.time != null)

  return (
    <div>
      <div className="mb-5 overflow-hidden rounded-xl bg-charcoal text-brand-50">
        <div className="h-1 bg-brand-400" />
        <div className="h-24 bg-gradient-to-br from-ink via-charcoal to-stone-800" />
        <div className="px-5 pb-5 -mt-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-sm bg-brand-400 font-display text-2xl font-bold text-charcoal">
            {card.photo || card.name.slice(0, 1)}
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-4xl font-semibold">{card.name}</h1>
              <p className="mt-1 text-sm text-stone-400">
                {card.sa} · {card.class} · {card.province}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.role === 'fan' ? <Button onClick={() => boostRider(card.id, 50)}>Boost R50</Button> : null}
              {user.role !== 'rider' && user.role !== 'fan' ? (
                <Button variant="secondary" onClick={() => payRiderDirect(card.id, 100)}>
                  Direct pay R100
                </Button>
              ) : null}
              {who && who !== card.id ? (
                <Button variant="ghost" onClick={() => toggleFollow(card.id)}>
                  {following.includes(card.id) ? 'Following' : 'Follow'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Rank" value={`#${rank}`} />
        <StatCard label="Points" value={card.points} />
        <StatCard label="Shows" value={shows} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Barn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {horses.map((h) => (
              <Link key={h.id} to={`/horses/${h.id}`} className="block rounded-md border border-dust-200 px-4 py-3">
                <p className="font-semibold">{h.name}</p>
                <p className="text-sm text-stone-600">
                  {h.sex} · {h.age}yo · {h.colour} · {h.height}
                </p>
              </Link>
            ))}
            {mine ? (
              <Button size="sm" variant="secondary" onClick={() => registerHorse(card.id, { name: 'New prospect' })}>
                Register a horse
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Card</CardTitle>
            <CardDescription>Biggest fan · {fan?.name || '—'}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Sponsors · {card.sponsors.length ? card.sponsors.join(', ') : 'Open'}</p>
            {mine ? (
              <Input value={bio} onChange={(e) => setBio(e.target.value)} onBlur={() => saveProfile(card.id, { bio })} />
            ) : (
              <p className="text-stone-600">{card.bio}</p>
            )}
            <p className="text-xs uppercase tracking-wide text-stone-500">Season results</p>
            <ul className="space-y-1">
              {results.map((r) => (
                <li key={r.id}>
                  {world.events.find((e) => e.id === r.eventId)?.name} · {r.time.toFixed(3)} · {r.division}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
