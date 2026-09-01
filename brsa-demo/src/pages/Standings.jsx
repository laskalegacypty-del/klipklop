import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { PageHeader } from '../components/ui/PageHeader'
import { Table, TableWrap, Td, Th } from '../components/ui/Table'
import { Tabs } from '../components/ui/Tabs'

const TABS = [
  { id: 'points', label: 'Points' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'lte', label: 'LTE' },
  { id: 'horse', label: 'Horse' },
  { id: 'province', label: 'Province' },
  { id: 'prior', label: '2025/26' },
]

export function Standings() {
  const { officialStandings, world, eventById } = useDemo()
  const [tab, setTab] = useState('points')
  const west = eventById('west-fest')
  const riders = officialStandings()
  const byEarn = [...world.riders].sort((a, b) => b.earnings - a.earnings)
  const byLte = [...world.riders].sort((a, b) => b.lte - a.lte)
  const horses = [...world.horses].sort((a, b) => b.lte - a.lte)
  const provinces = [...new Set(world.riders.map((r) => r.province))]

  return (
    <div>
      <PageHeader
        title="Standings"
        description="Official events only. Unofficial jackpot does not move this board."
        actions={!west.official ? <Badge variant="warning">West Fest not in yet</Badge> : <Badge variant="success">West Fest official</Badge>}
      />
      <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === 'points' && (
          <Board
            rows={riders.map((r, i) => ({
              id: r.id,
              rank: i + 1,
              name: r.name,
              meta: r.province,
              value: `${r.points} pts`,
              to: `/riders/${r.id}`,
            }))}
          />
        )}
        {tab === 'earnings' && (
          <Board
            rows={byEarn.map((r, i) => ({
              id: r.id,
              rank: i + 1,
              name: r.name,
              meta: r.class,
              value: rand(r.earnings),
              to: `/riders/${r.id}`,
            }))}
          />
        )}
        {tab === 'lte' && (
          <Board
            rows={byLte.map((r, i) => ({
              id: r.id,
              rank: i + 1,
              name: r.name,
              meta: r.sa,
              value: rand(r.lte),
              to: `/riders/${r.id}`,
            }))}
          />
        )}
        {tab === 'horse' && (
          <Board
            rows={horses.map((h, i) => ({
              id: h.id,
              rank: i + 1,
              name: h.name,
              meta: `${h.rank ? `${h.rank} · ` : ''}${h.futurity ? 'Futurity' : 'Open'}`,
              value: rand(h.lte),
            }))}
          />
        )}
        {tab === 'province' && (
          <div className="space-y-4">
            {provinces.map((p) => (
              <div key={p}>
                <h3 className="mb-2 font-display text-lg">{p}</h3>
                <Board
                  rows={riders
                    .filter((r) => r.province === p)
                    .map((r, i) => ({
                      id: r.id,
                      rank: i + 1,
                      name: r.name,
                      meta: r.class,
                      value: `${r.points} pts`,
                      to: `/riders/${r.id}`,
                    }))}
                />
              </div>
            ))}
          </div>
        )}
        {tab === 'prior' && (
          <Board
            rows={world.priorYearStandings.map((r) => ({
              id: r.name,
              rank: r.rank,
              name: r.name,
              meta: r.province,
              value: `${r.points} pts`,
            }))}
          />
        )}
      </div>
    </div>
  )
}

function Board({ rows }) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Rank</Th>
            <Th>Name</Th>
            <Th> </Th>
            <Th> </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="font-semibold">{row.rank}</Td>
              <Td>
                {row.to ? (
                  <Link className="font-semibold hover:underline" to={row.to}>
                    {row.name}
                  </Link>
                ) : (
                  row.name
                )}
              </Td>
              <Td className="text-stone-500">{row.meta}</Td>
              <Td className="font-semibold">{row.value}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  )
}
