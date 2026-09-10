import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'
import { Table, TableWrap, Td, Th } from '../components/ui/Table'
import { Tabs } from '../components/ui/Tabs'

export function Standings() {
  const { officialStandings, world, eventById, horseStandings } = useDemo()
  const [tab, setTab] = useState('points')
  const [klass, setKlass] = useState('Adult')
  const [season, setSeason] = useState('2025/26')
  const [div, setDiv] = useState('1D')
  const west = eventById('west-fest')
  const riders = officialStandings()
  const classes = [...new Set(world.riders.map((r) => r.class))]
  const seasons = Object.keys(world.priorYearStandings || {})
  const horses = horseStandings(div)

  return (
    <div>
      <PageHeader
        title="Standings"
        description="Official events only."
        actions={!west.official ? <Badge variant="warning">West Fest not in yet</Badge> : <Badge variant="success">West Fest official</Badge>}
      />
      <Tabs
        tabs={[
          { id: 'points', label: 'Points' },
          { id: 'horse', label: 'Horse' },
          { id: 'prior', label: 'Prior years' },
          { id: 'earnings', label: 'Earnings' },
          { id: 'province', label: 'Province' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />
      <div className="mt-5">
        {tab === 'points' && (
          <div>
            <Select className="mb-3 w-40" value={klass} onChange={(e) => setKlass(e.target.value)}>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Board
              rows={riders
                .filter((r) => r.class === klass)
                .map((r, i) => ({ id: r.id, rank: i + 1, name: r.name, meta: r.province, value: `${r.points} pts`, to: `/riders/${r.id}` }))}
            />
          </div>
        )}
        {tab === 'horse' && (
          <div>
            <Select className="mb-3 w-32" value={div} onChange={(e) => setDiv(e.target.value)}>
              {['1D', '2D', '3D', '4D', '5D'].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Board
              rows={horses.map((h, i) => ({
                id: h.horseId,
                rank: i + 1,
                name: h.horse?.name,
                meta: `${h.wins} wins · avg ${h.avg.toFixed(3)}`,
                value: rand(h.horse?.lte ?? 0),
                to: `/horses/${h.horseId}`,
              }))}
            />
          </div>
        )}
        {tab === 'prior' && (
          <div>
            <Select className="mb-3 w-40" value={season} onChange={(e) => setSeason(e.target.value)}>
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Board
              rows={(world.priorYearStandings[season] || []).map((r) => ({
                id: r.name,
                rank: r.rank,
                name: r.name,
                meta: `${r.class} · ${r.province}`,
                value: `${r.points} pts`,
              }))}
            />
          </div>
        )}
        {tab === 'earnings' && (
          <Board
            rows={[...world.riders]
              .sort((a, b) => b.earnings - a.earnings)
              .map((r, i) => ({ id: r.id, rank: i + 1, name: r.name, meta: r.class, value: rand(r.earnings), to: `/riders/${r.id}` }))}
          />
        )}
        {tab === 'province' && (
          <div className="space-y-4">
            {[...new Set(world.riders.map((r) => r.province))].map((p) => (
              <div key={p}>
                <h3 className="mb-2 font-display text-lg">{p}</h3>
                <Board
                  rows={riders
                    .filter((r) => r.province === p)
                    .map((r, i) => ({ id: r.id, rank: i + 1, name: r.name, meta: r.class, value: `${r.points} pts`, to: `/riders/${r.id}` }))}
                />
              </div>
            ))}
          </div>
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
            <Th></Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className={row.rank === 1 ? 'font-semibold text-season' : 'font-semibold'}>{row.rank}</Td>
              <Td>
                {row.to ? (
                  <Link className="font-semibold underline" to={row.to}>
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
