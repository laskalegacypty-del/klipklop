import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { FINE_TYPES, rand, seasonStartDate } from '../demo/money'
import { isFedStaff } from '../demo/world'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'

export function ProducerPage() {
  const {
    user,
    producer,
    world,
    entriesFor,
    estimateEventPayout,
    createEvent,
    issueFine,
    postNews,
    adjustPoints,
    downloadMemberList,
    recomputeAgeClasses,
    resolveQuery,
    riderById,
    horseById,
    eventById,
  } = useDemo()
  const [fine, setFine] = useState({ riderId: 'sunny', amount: 250, label: 'Late admin fee', fineType: 'late-admin' })
  const [news, setNews] = useState('')
  const [adj, setAdj] = useState({ riderId: 'sunny', delta: 1, note: 'Correction' })

  if ((user.role !== 'producer' || !producer) && !isFedStaff(user.role)) {
    return <EmptyState title="Producer desk" description="Event running, fines, official results and news live here." />
  }

  const events = producer
    ? world.events.filter((e) => e.producerId === producer.id)
    : world.events
  const openQueries = (world.timeQueries ?? []).filter((q) => q.status === 'open')
  const unpaid = world.invoices.filter((i) => !i.paid)
  const due = world.riders.filter((r) => /due|day/i.test(r.membershipNote) || world.invoices.some((i) => i.riderId === r.id && i.type === 'membership' && !i.paid))
  const start = seasonStartDate(world.season)
  const byProvince = {}
  for (const r of world.riders) {
    const slot = (byProvince[r.province] ??= { total: 0, joined: 0 })
    slot.total += 1
    if (r.joinedAt && new Date(r.joinedAt) >= start) slot.joined += 1
  }

  return (
    <div>
      <PageHeader
        title="Show office"
        description={
          producer
            ? `${producer.name} · ${producer.region}`
            : 'Federation view — all producers and shows.'
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{rand(world.brsaWallet)}</CardTitle>
            <CardDescription>BRSA's cut from official shows</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{unpaid.length}</CardTitle>
            <CardDescription>Unpaid invoices</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{due.length}</CardTitle>
            <CardDescription>Membership due / day members</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Members — {world.riders.length}</CardTitle>
            <CardDescription>Season roster</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={downloadMemberList}>Download member list PDF</Button>
            <Button variant="ghost" onClick={recomputeAgeClasses}>Recompute age classes</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Growth by province</CardTitle>
          <CardDescription>Total members · joined since 1 July</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 text-sm">
          {Object.entries(byProvince).map(([province, row]) => (
            <p key={province}>
              {province}: {row.total}+{row.joined}
            </p>
          ))}
        </CardContent>
      </Card>

      {openQueries.length ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Time queries</CardTitle>
            <CardDescription>Riders flag unofficial clocks here. Resolve them from the show office — not My times.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openQueries.map((q) => {
              const row = world.results.find((r) => r.id === q.resultId)
              return (
                <div key={q.id} className="rounded-md border border-dust-200 px-4 py-3">
                  <p className="font-semibold">
                    {riderById(q.riderId)?.name} · {horseById(row?.horseId)?.name} · {eventById(row?.eventId)?.name}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">{q.note}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => resolveQuery(q.id, 'accepted')}>
                      Yes — run them again
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => resolveQuery(q.id, 'rejected')}>
                      Time stands
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => resolveQuery(q.id, 'need-detail', 'Please send a video.')}>
                      Please send a video
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      <h2 className="mt-8 mb-3 font-display text-xl">Calendar</h2>
      <div className="grid gap-3">
        {events.map((event) => {
          const paid = entriesFor(event.id, { paidOnly: true })
          const est = estimateEventPayout(event.id)
          return (
            <Card key={event.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {event.name}
                  {event.status === 'live' ? <Badge variant="danger">Live today</Badge> : event.official ? <Badge variant="success">Official</Badge> : <Badge>Upcoming</Badge>}
                </CardTitle>
                <CardDescription>
                  {paid.length} paid · prize estimate {rand(est.prizePool)} · BRSA {rand(est.brsaAdmin)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Link to={`/events/${event.id}`}>
                  <Button variant="secondary">Flyer</Button>
                </Link>
                <Link to={`/events/${event.id}/day`}>
                  <Button>Event day</Button>
                </Link>
                <Link to={`/events/${event.id}?tab=payout`}>
                  <Button variant="ghost">Payout</Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>New event</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() =>
              createEvent({
                name: 'Coastal Jackpot',
                date: '2026-11-08',
                venue: 'Malmesbury',
                type: 'Jackpot',
                runs: 2,
              })
            }
          >
            Create sample jackpot
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Issue a fine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={fine.riderId} onChange={(e) => setFine({ ...fine, riderId: e.target.value })}>
              {world.riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Select value={fine.fineType} onChange={(e) => setFine({ ...fine, fineType: e.target.value, label: FINE_TYPES.find((t) => t.id === e.target.value)?.label || fine.label })}>
              {FINE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </Select>
            <Input value={fine.label} onChange={(e) => setFine({ ...fine, label: e.target.value })} />
            <Input type="number" value={fine.amount} onChange={(e) => setFine({ ...fine, amount: e.target.value })} />
            <Button onClick={() => issueFine(fine)}>Issue fine</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Points correction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={adj.riderId} onChange={(e) => setAdj({ ...adj, riderId: e.target.value })}>
              {world.riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Input type="number" value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} />
            <Button variant="secondary" onClick={() => adjustPoints(adj.riderId, adj.delta, adj.note)}>
              Apply
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Post to news</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input value={news} onChange={(e) => setNews(e.target.value)} placeholder="Rule update, award, notice…" />
          <Button
            onClick={() => {
              if (news.trim()) postNews(news.trim())
              setNews('')
            }}
          >
            Post
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
