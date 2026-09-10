import { useMemo, useState } from 'react'
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
  const { user, rider, world, riderById, horseById, eventById, queryTime, resolveQuery } = useDemo()
  const [tab, setTab] = useState('runs')
  const [year, setYear] = useState('all')
  const [province, setProvince] = useState('all')
  const [note, setNote] = useState('Clock looked fast out of the second barrel.')

  const runs = useMemo(() => {
    let rows = world.results.filter((r) => r.time != null)
    if (user.role === 'rider' && rider) rows = rows.filter((r) => r.riderId === rider.id)
    if (year !== 'all') rows = rows.filter((r) => (eventById(r.eventId)?.date || '').startsWith(year))
    if (province !== 'all') rows = rows.filter((r) => riderById(r.riderId)?.province === province)
    return rows
  }, [world.results, user.role, rider, year, province, eventById, riderById])

  const queries = world.timeQueries ?? []
  const mine = user.role === 'rider' && rider ? queries.filter((q) => q.riderId === rider.id) : queries

  if (user.role !== 'rider' && user.role !== 'producer') {
    return <EmptyState title="Times" description="Check your clocks here. If a time looks wrong, tell the office within seven days." />
  }

  const years = [...new Set(world.events.map((e) => e.date.slice(0, 4)))]
  const provinces = [...new Set(world.riders.map((r) => r.province))]
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
        <Select value={province} onChange={(e) => setProvince(e.target.value)} className="w-44">
          <option value="all">All provinces</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>
      {tab === 'runs' ? (
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
                      {user.role === 'rider' && windowOk(ev) ? (
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
      ) : (
        <div className="mt-4 space-y-3">
          {user.role === 'rider' ? (
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What looked wrong?" />
          ) : null}
          {mine.length === 0 ? (
            <EmptyState title="No queries" description="Unofficial times can be queried for seven days." />
          ) : (
            mine.map((q) => {
              const row = world.results.find((r) => r.id === q.resultId)
              return (
                <Card key={q.id}>
                  <CardHeader>
                    <CardTitle>{riderById(q.riderId)?.name}</CardTitle>
                    <CardDescription>
                      {q.status} · {horseById(row?.horseId)?.name} · {q.note}
                    </CardDescription>
                  </CardHeader>
                  {user.role === 'producer' && q.status === 'open' ? (
                    <CardContent className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => resolveQuery(q.id, 'accepted')}>
                        Yes — run them again
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => resolveQuery(q.id, 'rejected')}>
                        Time stands
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resolveQuery(q.id, 'need-detail', 'Please send a video.')}>
                        Please send a video
                      </Button>
                    </CardContent>
                  ) : null}
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
