import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'
import { Table, TableWrap, Td, Th } from '../components/ui/Table'

function statusOf(event) {
  if (event.status === 'live') return { label: 'Live today', variant: 'danger' }
  if (event.official) return { label: 'Official', variant: 'success' }
  if (event.resultsPostedAt) return { label: 'Unofficial', variant: 'warning' }
  return { label: 'Upcoming', variant: 'default' }
}

const filterControl = 'h-9 shadow-none'

export function Events() {
  const { world } = useDemo()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [region, setRegion] = useState('all')
  const [status, setStatus] = useState('all')
  const types = [...new Set(world.events.map((e) => e.type))]
  const regions = [...new Set(world.events.map((e) => e.region))]
  const events = useMemo(() => {
    return [...world.events]
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((e) => {
        if (q && !`${e.name} ${e.venue}`.toLowerCase().includes(q.toLowerCase())) return false
        if (type !== 'all' && e.type !== type) return false
        if (region !== 'all' && e.region !== region) return false
        if (status === 'live' && e.status !== 'live') return false
        if (status === 'official' && !e.official) return false
        if (status === 'upcoming' && (e.official || e.status === 'live')) return false
        return true
      })
  }, [world.events, q, type, region, status])

  return (
    <div>
      <PageHeader title="Events" description="Mini-Qualifier · Jackpot · Rodeo" />
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th
                filter={
                  <Input
                    className={filterControl}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search"
                  />
                }
              >
                Event
              </Th>
              <Th
                filter={
                  <Select className={filterControl} value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="all">All</option>
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                }
              >
                Type
              </Th>
              <Th
                filter={
                  <Select className={filterControl} value={region} onChange={(e) => setRegion(e.target.value)}>
                    <option value="all">All</option>
                    {regions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                }
              >
                Region
              </Th>
              <Th>Venue</Th>
              <Th
                filter={
                  <Select className={filterControl} value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="all">All</option>
                    <option value="live">Live today</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="official">Official</option>
                  </Select>
                }
              >
                Status
              </Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <Td colSpan={7} className="text-stone-500">
                  No events match those filters.
                </Td>
              </tr>
            ) : (
              events.map((event) => {
                const st = statusOf(event)
                return (
                  <tr key={event.id} className="hover:bg-dust-50">
                    <Td className="whitespace-nowrap">{event.date}</Td>
                    <Td className="font-semibold">{event.name}</Td>
                    <Td>{event.type}</Td>
                    <Td>{event.region}</Td>
                    <Td>{event.venue}</Td>
                    <Td>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </Td>
                    <Td>
                      <Link className="font-semibold text-season underline" to={`/events/${event.id}`}>
                        Open flyer
                      </Link>
                    </Td>
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  )
}
