import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { DIVISIONS, rand } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'
import { Table, TableWrap, Td, Th } from '../components/ui/Table'
import { Tabs } from '../components/ui/Tabs'

const filterControl = 'h-9 shadow-none'

function Board({ columns, rows }) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            {columns.map((col) => (
              <Th key={col.key} filter={col.filter}>
                {col.label}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <Td colSpan={columns.length} className="text-stone-500">
                Nothing on this board. Try another filter.
              </Td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-dust-50">
                {columns.map((col) => {
                  const cell = row[col.key]
                  const isName = col.key === 'name' && row.to
                  return (
                    <Td key={col.key} className={col.className}>
                      {isName ? (
                        <Link className="font-semibold underline" to={row.to}>
                          {cell}
                        </Link>
                      ) : (
                        cell
                      )}
                    </Td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </TableWrap>
  )
}

export function Standings() {
  const { officialStandings, world, eventById, horseStandings, riderById } = useDemo()
  const [tab, setTab] = useState('points')
  const [q, setQ] = useState('')
  const [klass, setKlass] = useState('all')
  const [season, setSeason] = useState('2025/26')
  const [div, setDiv] = useState('all')
  const [province, setProvince] = useState('all')
  const west = eventById('west-fest')
  const riders = officialStandings()
  const classes = [...new Set(world.riders.map((r) => r.class))]
  const provinces = [...new Set(world.riders.map((r) => r.province))]
  const seasons = Object.keys(world.priorYearStandings || {})

  const matches = (name, extra = '') => {
    const query = q.trim().toLowerCase()
    if (!query) return true
    return `${name} ${extra}`.toLowerCase().includes(query)
  }

  const pointRows = useMemo(() => {
    return riders
      .filter((r) => (klass === 'all' || r.class === klass) && (province === 'all' || r.province === province) && matches(r.name, `${r.class} ${r.province}`))
      .map((r, i) => ({
        id: r.id,
        rank: i + 1,
        name: r.name,
        class: r.class,
        province: r.province,
        points: r.points,
        to: `/riders/${r.id}`,
      }))
  }, [riders, klass, province, q])

  const horseRows = useMemo(() => {
    return horseStandings(div === 'all' ? null : div)
      .filter((h) => matches(h.horse?.name, riderById(h.horse?.riderId)?.name))
      .map((h, i) => ({
        id: h.horseId,
        rank: i + 1,
        name: h.horse?.name,
        rider: riderById(h.horse?.riderId)?.name,
        wins: h.wins,
        avg: h.avg ? h.avg.toFixed(3) : '—',
        lte: rand(h.horse?.lte ?? 0),
        to: `/horses/${h.horseId}`,
      }))
  }, [div, q, horseStandings, riderById])

  const priorRows = useMemo(() => {
    return (world.priorYearStandings[season] || [])
      .filter((r) => (klass === 'all' || r.class === klass) && matches(r.name, `${r.class} ${r.province}`))
      .map((r) => ({
        id: `${season}-${r.name}`,
        rank: r.rank,
        name: r.name,
        class: r.class,
        province: r.province,
        points: r.points,
      }))
  }, [world.priorYearStandings, season, klass, q])

  const earningRows = useMemo(() => {
    return [...world.riders]
      .filter((r) => (klass === 'all' || r.class === klass) && matches(r.name, r.class))
      .sort((a, b) => b.earnings - a.earnings)
      .map((r, i) => ({
        id: r.id,
        rank: i + 1,
        name: r.name,
        class: r.class,
        province: r.province,
        earnings: rand(r.earnings),
        to: `/riders/${r.id}`,
      }))
  }, [world.riders, klass, q])

  const searchRider = (
    <Input className={filterControl} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
  )
  const classFilter = (
    <Select className={filterControl} value={klass} onChange={(e) => setKlass(e.target.value)}>
      <option value="all">All</option>
      {classes.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Select>
  )
  const provinceFilter = (
    <Select className={filterControl} value={province} onChange={(e) => setProvince(e.target.value)}>
      <option value="all">All</option>
      {provinces.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </Select>
  )

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
        onChange={(next) => {
          setTab(next)
          setQ('')
        }}
      />
      <div className="mt-5">
        {tab === 'points' || tab === 'province' ? (
          <Board
            columns={[
              { key: 'rank', label: 'Rank', className: 'font-semibold' },
              { key: 'name', label: 'Rider', filter: searchRider },
              { key: 'class', label: 'Class', filter: classFilter },
              { key: 'province', label: 'Province', filter: provinceFilter },
              { key: 'points', label: 'Points', className: 'font-semibold' },
            ]}
            rows={pointRows}
          />
        ) : null}
        {tab === 'horse' ? (
          <Board
            columns={[
              {
                key: 'rank',
                label: 'Rank',
                className: 'font-semibold',
                filter: (
                  <Select className={filterControl} value={div} onChange={(e) => setDiv(e.target.value)}>
                    <option value="all">All</option>
                    {DIVISIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                ),
              },
              {
                key: 'name',
                label: 'Horse',
                filter: <Input className={filterControl} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />,
              },
              { key: 'rider', label: 'Rider' },
              { key: 'wins', label: 'Wins' },
              { key: 'avg', label: 'Avg' },
              { key: 'lte', label: 'LTE', className: 'font-semibold' },
            ]}
            rows={horseRows}
          />
        ) : null}
        {tab === 'prior' ? (
          <Board
            columns={[
              {
                key: 'rank',
                label: 'Rank',
                className: 'font-semibold',
                filter: (
                  <Select className={filterControl} value={season} onChange={(e) => setSeason(e.target.value)}>
                    {seasons.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                ),
              },
              { key: 'name', label: 'Rider', filter: searchRider },
              { key: 'class', label: 'Class', filter: classFilter },
              { key: 'province', label: 'Province' },
              { key: 'points', label: 'Points', className: 'font-semibold' },
            ]}
            rows={priorRows}
          />
        ) : null}
        {tab === 'earnings' ? (
          <Board
            columns={[
              { key: 'rank', label: 'Rank', className: 'font-semibold' },
              { key: 'name', label: 'Rider', filter: searchRider },
              { key: 'class', label: 'Class', filter: classFilter },
              { key: 'province', label: 'Province' },
              { key: 'earnings', label: 'Earnings', className: 'font-semibold' },
            ]}
            rows={earningRows}
          />
        ) : null}
      </div>
    </div>
  )
}
