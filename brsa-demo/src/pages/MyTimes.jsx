import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'
import { Table, TableWrap, Td, Th } from '../components/ui/Table'
import { Tabs } from '../components/ui/Tabs'

export function MyTimes() {
  const { user, rider, world, horseById, eventById, queryTime } = useDemo()
  const [tab, setTab] = useState('runs')
  const [year, setYear] = useState('all')
  const [note, setNote] = useState('Clock looked fast out of the second barrel.')

  const runs = useMemo(() => {
    if (!rider) return []
    return world.results
      .filter((r) => r.riderId === rider.id && r.time != null)
      .filter((r) => year === 'all' || (eventById(r.eventId)?.date || '').startsWith(year))
  }, [world.results, rider, year, eventById])

  const mine = rider ? (world.timeQueries ?? []).filter((q) => q.riderId === rider.id) : []

  if (user.role !== 'rider' || !rider) {
    return <Navigate to={user.role === 'producer' ? '/producer' : '/'} replace />
  }

  const years = [...new Set(world.events.map((e) => e.date.slice(0, 4)))]
  const windowOk = (event) => {
    if (!event?.resultsPostedAt || event.official) return false
    return Date.now() < new Date(event.resultsPostedAt).getTime() + 7 * 86400000
  }

  return (
    <div>
      <PageHeader title="My times" description="If a clock looks wrong, you have seven days to say so — before it is official." />
      <Tabs
        tabs={[
          { id: 'runs', label: 'Your runs' },
          { id: 'queries', label: 'Times I queried' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-32">
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      {tab === 'runs' ? (
        runs.length === 0 ? (
          <EmptyState className="mt-4" title="No times yet" description="Paid runs with a clock show here." />
        ) : (
          <TableWrap className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Event</Th>
                  <Th>Horse</Th>
                  <Th>Time</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((row) => {
                  const ev = eventById(row.eventId)
                  return (
                    <tr key={row.id}>
                      <Td>{ev?.name}</Td>
                      <Td>{horseById(row.horseId)?.name}</Td>
                      <Td>{row.time?.toFixed(3)}</Td>
                      <Td>
                        {windowOk(ev) ? (
                          <Button size="sm" variant="secondary" onClick={() => queryTime(row.id, note)}>
                            This time looks wrong
                          </Button>
                        ) : null}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </TableWrap>
        )
      ) : (
        <div className="mt-4 space-y-3">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What looked wrong?" />
          {mine.length === 0 ? (
            <EmptyState title="No queries" description="Unofficial times can be queried for seven days." />
          ) : (
            mine.map((q) => {
              const row = world.results.find((r) => r.id === q.resultId)
              return (
                <Card key={q.id}>
                  <CardHeader>
                    <CardTitle>{eventById(row?.eventId)?.name || 'Run'}</CardTitle>
                    <CardDescription>
                      {q.status} · {horseById(row?.horseId)?.name} · {q.note}
                    </CardDescription>
                  </CardHeader>
                  {q.reply ? <CardContent className="text-sm text-stone-600">{q.reply}</CardContent> : null}
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
