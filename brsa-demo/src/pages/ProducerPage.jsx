import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'

export function ProducerPage() {
  const { user, producer, world, entriesFor, estimateEventPayout, createEvent, issueFine, postNews, adjustPoints } = useDemo()
  const [fine, setFine] = useState({ riderId: 'sunny', amount: 250, label: 'Late admin fee' })
  const [news, setNews] = useState('')
  const [adj, setAdj] = useState({ riderId: 'sunny', delta: 1, note: 'Correction' })

  if (user.role !== 'producer' || !producer) {
    return <EmptyState title="Producer desk" description="Event running, fines, official results and news live here." />
  }

  const events = world.events.filter((e) => e.producerId === producer.id)
  const unpaid = world.invoices.filter((i) => !i.paid)
  const due = world.riders.filter((r) => /due|day/i.test(r.membershipNote) || world.invoices.some((i) => i.riderId === r.id && i.type === 'membership' && !i.paid))

  return (
    <div>
      <PageHeader title="Show office" description={`${producer.name} · ${producer.region}`} />
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
      </div>

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
