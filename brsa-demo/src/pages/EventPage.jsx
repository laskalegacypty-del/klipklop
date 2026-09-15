import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { CLASS_FEES, CARRY_OVER_FEE, DIVISIONS, PRODUCING_COST, entryFee, pointsForResult, rand } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'
import { Table, TableWrap, Td, Th } from '../components/ui/Table'
import { Tabs } from '../components/ui/Tabs'

const TABS = [
  { id: 'flyer', label: 'Flyer' },
  { id: 'enter', label: 'Enter' },
  { id: 'draw', label: 'Draw' },
  { id: 'results', label: 'Results' },
  { id: 'payout', label: 'Payout' },
]

export function EventPage() {
  const { eventId } = useParams()
  const [params, setParams] = useSearchParams()
  const demo = useDemo()
  const tabs = demo.user.role === 'fan' ? TABS.filter((t) => t.id !== 'enter') : TABS
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'flyer'
  const event = demo.eventById(eventId)

  if (!event) {
    return <p className="text-stone-600">Event not found.</p>
  }

  const producer = demo.world.producers.find((p) => p.id === event.producerId)

  return (
    <div>
      <PageHeader
        title={event.name}
        description={`${event.date} · ${event.venue}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {demo.user.role === 'producer' ? (
              <Link to={`/events/${event.id}/day`}>
                <Button size="sm">Event day</Button>
              </Link>
            ) : null}
            {event.official ? (
              <Badge variant="success">Official</Badge>
            ) : event.status === 'live' ? (
              <Badge variant="danger">Live today</Badge>
            ) : event.resultsPostedAt ? (
              <Badge variant="warning">Unofficial</Badge>
            ) : (
              <Badge>Upcoming</Badge>
            )}
          </div>
        }
      />
      <Tabs tabs={tabs} activeTab={tab} onChange={(id) => setParams({ tab: id })} />
      <div className="mt-5">
        {tab === 'flyer' && <Flyer event={event} producer={producer} />}
        {tab === 'enter' && <Enter event={event} />}
        {tab === 'draw' && <Draw event={event} />}
        {tab === 'results' && <Results event={event} />}
        {tab === 'payout' && <Payout event={event} />}
      </div>
    </div>
  )
}

function Flyer({ event, producer }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Event flyer</CardTitle>
          <CardDescription>{event.type} · {event.region}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-stone-700 leading-relaxed">{event.flyer}</p>
          <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-stone-500">Class fees</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {event.classes.map((klass) => (
              <li key={klass} className="rounded-md border border-dust-200 bg-dust-50 px-3 py-2">
                {klass} <span className="font-semibold">{rand(CLASS_FEES[klass])}</span>
              </li>
            ))}
            <li className="rounded-md border border-brand-400 bg-brand-50 px-3 py-2">
              Carry-over <span className="font-semibold">+{rand(CARRY_OVER_FEE)}</span>
            </li>
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Producer</CardTitle>
          <CardDescription>{producer?.region}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p className="font-semibold">{producer?.name}</p>
          <p>{producer?.phone}</p>
          <p className="text-stone-600">{producer?.email}</p>
          <p className="pt-3 text-stone-500">Per-event admin / producing cost: {rand(event.adminFee)}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Enter({ event }) {
  const { user, rider, unpaidFines, unpaidMembership, enterEvent, world, horseById, payInvoice } = useDemo()
  const horses = rider ? world.horses.filter((h) => h.riderId === rider.id) : []
  const [klass, setKlass] = useState(rider?.class ?? 'Adult')
  const [horseId, setHorseId] = useState(horses[0]?.id ?? '')
  const [carryOver, setCarryOver] = useState(false)
  const fines = rider ? unpaidFines(rider.id) : []
  const dues = rider ? unpaidMembership(rider.id) : []
  const fee = entryFee(klass, carryOver)
  const already = rider
    ? world.entries.find((e) => e.eventId === event.id && e.riderId === rider.id)
    : null

  if (user.role !== 'rider' || !rider) {
    return (
      <EmptyState
        title="Entries are for riders"
        description="Switch to a rider to put a horse on this draw."
      />
    )
  }

  if (event.official) {
    return (
      <EmptyState title="Entries closed" description="This event is official. The books are shut." />
    )
  }

  if (fines.length) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle>Pay this fine first</CardTitle>
          <CardDescription>The office will not take your name while a fine is open.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fines.map((f) => (
            <p key={f.id} className="text-sm font-medium">
              {f.label} — {rand(f.amount)}
            </p>
          ))}
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => payInvoice(fines[0].id)}>
                Pay {rand(fines[0].amount)}
              </Button>
              <Link to="/wallet">
                <Button variant="secondary">See what I owe</Button>
              </Link>
            </div>
        </CardContent>
      </Card>
    )
  }

  if (dues.length) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle>Membership renewal is due</CardTitle>
          <CardDescription>The office will not take a new entry until this invoice is paid.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dues.map((f) => (
            <p key={f.id} className="text-sm font-medium">
              {f.label} — {rand(f.amount)}
            </p>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={() => payInvoice(dues[0].id, { fromWallet: true })}>
              Pay {rand(dues[0].amount)}
            </Button>
            <Link to="/wallet">
              <Button variant="secondary">See what I owe</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (already) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You’re entered</CardTitle>
          <CardDescription>
            {already.class}
            {already.carryOver ? ' + second run' : ''} · {already.paid ? 'Paid — you are on the draw' : 'Not paid yet — you are not on the draw'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!already.paid ? (
            <p className="text-sm text-stone-600">
              Pay the entry under <Link className="underline" to="/wallet">Money</Link> and your name goes on the draw.
            </p>
          ) : (
            <Link to={`/events/${event.id}?tab=draw`}>
              <Button>See the draw</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter {event.name}</CardTitle>
        <CardDescription>
          {horseById(horseId)?.name ?? 'Pick a horse'} · {klass}
          {carryOver ? ' + carry-over' : ''} · {rand(fee)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 max-w-md">
        <label className="text-sm font-medium">
          Horse
          <Select className="mt-1" value={horseId} onChange={(e) => setHorseId(e.target.value)}>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-medium">
          Class
          <Select className="mt-1" value={klass} onChange={(e) => setKlass(e.target.value)}>
            {event.classes.map((c) => (
              <option key={c} value={c}>
                {c} · {rand(CLASS_FEES[c])}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={carryOver} onChange={(e) => setCarryOver(e.target.checked)} />
          Second run on the same horse (+{rand(CARRY_OVER_FEE)})
        </label>
        <p className="text-sm text-stone-600">Total {rand(fee)}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" onClick={() => enterEvent({ eventId: event.id, riderId: rider.id, horseId, klass, carryOver, payNow: true })}>
            Pay {rand(fee)} on my phone
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => enterEvent({ eventId: event.id, riderId: rider.id, horseId, klass, carryOver, payNow: false })}
          >
            Put me on the list — I will pay later
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Draw({ event }) {
  const { entriesFor, riderById, horseById, rider } = useDemo()
  const rows = entriesFor(event.id, { paidOnly: true })

  return (
    <div>
      <p className="mb-3 text-sm text-stone-600">Paid names only. Pay-later entries stay off this list until they settle.</p>
      {rows.length === 0 ? (
        <EmptyState title="Draw is empty" description="Names appear here once the entry is paid." />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Rider</Th>
                <Th>Horse</Th>
                <Th>Class</Th>
                <Th>Carry-over</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const mine = rider && row.riderId === rider.id
                return (
                  <tr key={row.id} className={mine ? 'bg-season-soft' : undefined}>
                    <Td>{i + 1}</Td>
                    <Td>
                      <Link className="link-quiet font-semibold underline" to={`/riders/${row.riderId}`}>
                        {riderById(row.riderId)?.name}
                      </Link>
                      {mine ? (
                        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-season">You</span>
                      ) : null}
                    </Td>
                    <Td>{horseById(row.horseId)?.name}</Td>
                    <Td>{row.class}</Td>
                    <Td>{row.carryOver ? 'Yes' : '—'}</Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  )
}

function Results({ event }) {
  const { resultsFor, riderById, horseById, user, makeOfficial } = useDemo()
  const rows = resultsFor(event.id)
  const grouped = useMemo(() => {
    const map = { '1D': [], '2D': [], '3D': [] }
    for (const row of rows) {
      ;(map[row.division] ??= []).push(row)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.place - b.place || a.time - b.time)
    }
    return map
  }, [rows])

  const holdUntil = event.resultsPostedAt
    ? new Date(new Date(event.resultsPostedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null
  const windowOpen = holdUntil && Date.now() < holdUntil.getTime() && !event.official

  return (
    <div className="space-y-4">
      {!event.official && event.resultsPostedAt ? (
        <div className="rounded-md border border-brand-400 bg-brand-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Unofficial — 7-day protest window</p>
              <p className="text-sm text-stone-600">
                Clock runs to {holdUntil?.toLocaleString('en-ZA')}. Standings do not move until official.
              </p>
            </div>
            {user.role === 'producer' ? (
              <div className="flex flex-wrap gap-2">
                <Button disabled={windowOpen} onClick={() => makeOfficial(event.id)}>
                  Make official
                </Button>
                {windowOpen ? (
                  <Button variant="ghost" onClick={() => makeOfficial(event.id, { override: true })}>
                    Override — mark official early (demo)
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-stone-500">The producer marks these official.</p>
            )}
          </div>
        </div>
      ) : event.official ? (
        <Badge variant="success">Official — points are live</Badge>
      ) : (
        <p className="text-sm text-stone-600">Results have not been posted.</p>
      )}

      {rows.length === 0 && !event.resultsPostedAt ? (
        <EmptyState title="No times yet" description="Divisional results will publish here after the last horse." />
      ) : null}

      {DIVISIONS.map((div) =>
        grouped[div]?.length ? (
          <div key={div}>
            <h3 className="mb-2 font-display text-lg font-semibold">{div}</h3>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Place</Th>
                    <Th>Rider</Th>
                    <Th>Horse</Th>
                    <Th>Class</Th>
                    <Th>Time</Th>
                    <Th>Points</Th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[div].map((row) => (
                    <tr key={row.id}>
                      <Td>{row.place}</Td>
                      <Td>{riderById(row.riderId)?.name}</Td>
                      <Td>{horseById(row.horseId)?.name}</Td>
                      <Td>{row.class}</Td>
                      <Td>{row.time?.toFixed(3)}</Td>
                      <Td>{pointsForResult(row)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>
        ) : null,
      )}
    </div>
  )
}

function Payout({ event }) {
  const { world, riderById, estimateEventPayout } = useDemo()
  const receipt = world.payouts[event.id]
  const estimate = estimateEventPayout(event.id)
  const numbers = receipt || estimate
  if (!numbers?.gross && !receipt) {
    return (
      <EmptyState
        title="No payout yet"
        description="Estimate fills from paid entries. The receipt is written when official."
      />
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Riders (prize)</CardTitle>
          <CardDescription>70% of the pool after R{event.adminFee ?? PRODUCING_COST} producing{receipt ? '' : ' · estimate'}</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{rand(numbers.prizePool)}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>BRSA admin</CardTitle>
          <CardDescription>30% after producing is taken off</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{rand(numbers.brsaAdmin)}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ground levy</CardTitle>
          <CardDescription>{rand(event.adminFee ?? PRODUCING_COST)} producing / entry × field</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{rand(numbers.groundLevy)}</CardContent>
      </Card>
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle>Rider shares — wallets updated</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {(receipt?.riderShares || []).map((s) => (
              <li key={s.riderId} className="flex justify-between">
                <span>{riderById(s.riderId)?.name}</span>
                <span className="font-semibold">{rand(s.amount)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
