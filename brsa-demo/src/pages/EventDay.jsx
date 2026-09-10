import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { heatRows } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Table, TableWrap, Td, Th } from '../components/ui/Table'
import { Tabs } from '../components/ui/Tabs'

export function EventDay() {
  const { eventId } = useParams()
  const { eventById, entriesFor, resultsFor, riderById, horseById, user, shuffleDraw, markEntryPaid, applyTimesheet, makeOfficial } = useDemo()
  const event = eventById(eventId)
  const [phase, setPhase] = useState('roster')
  const [sheet, setSheet] = useState('Diesel,16.421\nComet,16.910\nPepper,17.050')

  if (!event) return <p>Event not found.</p>
  if (user.role !== 'producer') {
    return <EmptyState title="Producer console" description="Event day running is a producer tool." />
  }

  const paid = entriesFor(event.id, { paidOnly: true })
  const unpaid = entriesFor(event.id).filter((e) => !e.paid)
  const missingDraw = paid.filter((e) => !e.drawNo)
  const heats = heatRows(paid, 5)
  const lateLink = `${window.location.origin}/events/${event.id}?tab=enter&guest=1`

  return (
    <div>
      <PageHeader
        title={`${event.name} — event day`}
        description={`${event.venue} · ${event.runs}-run`}
        actions={event.official ? <Badge variant="success">Official</Badge> : <Badge variant="danger">Live</Badge>}
      />
      <Tabs
        tabs={[
          { id: 'roster', label: 'Roster' },
          { id: 'running', label: 'Running' },
        ]}
        activeTab={phase}
        onChange={setPhase}
      />
      {phase === 'roster' ? (
        <div className="mt-5 space-y-4">
          {missingDraw.length ? (
            <p className="text-sm text-amber-800">{missingDraw.length} paid names have no draw number.</p>
          ) : (
            <p className="text-sm text-stone-600">Draw numbers are on the paid field.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => shuffleDraw(event.id)}>Shuffle the running order</Button>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(lateLink)
              }}
            >
              Copy link for a day member at the gate
            </Button>
            <a
              className="inline-flex"
              href={`data:text/plain,${encodeURIComponent(paid.map((e, i) => `${e.drawNo || i + 1}\t${riderById(e.riderId)?.name}\t${horseById(e.horseId)?.name}`).join('\n'))}`}
              download={`${event.id}-draw.txt`}
            >
              <Button variant="ghost">Draw TXT</Button>
            </a>
          </div>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Rider</Th>
                  <Th>Horse</Th>
                  <Th>Paid</Th>
                </tr>
              </thead>
              <tbody>
                {entriesFor(event.id).map((e) => (
                  <tr key={e.id}>
                    <Td>{e.drawNo || '—'}</Td>
                    <Td>{riderById(e.riderId)?.name}</Td>
                    <Td>{horseById(e.horseId)?.name}</Td>
                    <Td>
                      {e.paid ? (
                        'Paid'
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => markEntryPaid(e.id)}>
                          They paid cash
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          {unpaid.length ? <p className="text-sm text-stone-500">{unpaid.length} unpaid — off the draw.</p> : null}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Link to={`/events/${event.id}/timekeeper`}>
              <Button>Timekeeper (phone)</Button>
            </Link>
            {!event.official ? <Button onClick={() => makeOfficial(event.id)}>Make official</Button> : null}
          </div>
          {heats.map((heat, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>Heat {i + 1}</CardTitle>
                <CardDescription>Five on the gate</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                {heat.map((e) => {
                  const res = resultsFor(event.id).find((r) => r.entryId === e.id)
                  return (
                    <p key={e.id}>
                      {e.drawNo}. {riderById(e.riderId)?.name} / {horseById(e.horseId)?.name}
                      {res?.time ? ` · ${res.time.toFixed(3)}` : ' · no time'}
                    </p>
                  )
                })}
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardHeader>
              <CardTitle>Timesheet upload</CardTitle>
              <CardDescription>CSV / TXT — name, time. Next empty run is filled automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea className="w-full rounded-md border border-dust-200 p-3 font-mono text-sm" rows={5} value={sheet} onChange={(e) => setSheet(e.target.value)} />
              <Button variant="secondary" onClick={() => applyTimesheet(event.id, sheet)}>
                Apply sheet
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export function Timekeeper() {
  const { eventId } = useParams()
  const { eventById, entriesFor, resultsFor, riderById, horseById, recordTime, user } = useDemo()
  const event = eventById(eventId)
  const paid = entriesFor(eventId, { paidOnly: true })
  const [idx, setIdx] = useState(0)
  const [val, setVal] = useState('')
  const entry = paid[idx]
  const res = entry ? resultsFor(eventId).find((r) => r.entryId === entry.id) : null
  const run = res?.run1 == null ? 1 : event?.runs > 1 && res?.run2 == null ? 2 : 1

  if (user.role !== 'producer' || !event) {
    return <EmptyState title="Timekeeper" description="Open this from the producer Event day console." />
  }

  return (
    <div className="min-h-screen bg-charcoal text-white px-4 py-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-brand-300">{event.name}</p>
      <h1 className="font-display text-3xl mt-2">Timekeeper</h1>
      {entry ? (
        <div className="mt-8">
          <p className="text-stone-400">
            Draw {entry.drawNo} · Run {run} of {event.runs}
          </p>
          <p className="font-display text-4xl mt-2">{riderById(entry.riderId)?.name}</p>
          <p className="text-xl text-brand-300">{horseById(entry.horseId)?.name}</p>
          <Input className="mt-6 h-14 bg-white/10 text-white text-2xl border-white/20" value={val} onChange={(e) => setVal(e.target.value)} placeholder="16.421" />
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => {
                if (!res || !val) return
                recordTime(res.id, { run, time: val })
                setVal('')
                setIdx((i) => Math.min(paid.length - 1, i + 1))
              }}
            >
              Save time
            </Button>
            <Button variant="secondary" onClick={() => setIdx((i) => Math.max(0, i - 1))}>
              Prev
            </Button>
          </div>
          {res?.time ? <p className="mt-4 text-stone-400">Official (best): {res.time.toFixed(3)}</p> : null}
        </div>
      ) : (
        <p className="mt-8">No paid names.</p>
      )}
      <Link to={`/events/${eventId}/day`} className="mt-10 inline-block text-sm text-stone-400 underline">
        Back to event day
      </Link>
    </div>
  )
}
