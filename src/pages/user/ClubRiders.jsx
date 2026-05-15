import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { GAMES, AGE_CATEGORIES, PROVINCES, normalizeGameName } from '../../lib/constants'
import {
  fetchManagedRiders,
  createManagedRider,
  updateManagedRider,
  deleteManagedRider,
  fetchHeadHorses,
  fetchCombosForManagedRider,
  fetchCombosForLinkedRider,
  createManagedCombo,
  deleteCombo,
} from '../../lib/clubRiderRoster'
import { getLevel, getNationalsLevel, getTimeToNextLevel } from '../../lib/matrix'
import { EmptyState, PageHeader, Skeleton } from '../../components/ui'
import {
  UserSearch,
  UserPlus,
  Users,
  Trophy,
  ChevronDown,
  ChevronUp,
  Search,
  Star,
  TrendingUp,
  Trash2,
  UserCheck,
  Hourglass,
  Pencil,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTabQueryParam } from '../../lib/useTabQueryParam'

const CURRENT_YEAR = new Date().getFullYear()
const CLUB_RIDER_TABS = ['times', 'grid', 'history', 'trends']

const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700'
}

function buildYearOptions() {
  const years = []
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 4; y--) {
    years.push(y)
  }
  return years
}

function buildCarryForwardPbMap(rows) {
  const map = {}
  rows?.forEach(row => {
    const game = normalizeGameName(row.game)
    if (!game) return
    const current = map[game]
    if (!current || row.best_time < current.best_time) {
      map[game] = { ...row, game }
    }
  })
  return map
}

function formatPbDate(pb) {
  if (pb?.season_year) return String(pb.season_year)
  const fallback = pb?.achieved_at || pb?.updated_at || null
  return fallback ? String(new Date(fallback).getFullYear()) : '—'
}

function isCurrentYearPb(pb) {
  return Number(pb?.season_year) === CURRENT_YEAR
}

// ─────────────────────────────────────────────────────────
// RiderTimesView — read-only times for one combo
// ─────────────────────────────────────────────────────────
function RiderTimesView({ combo, selectedYear }) {
  const [personalBests, setPersonalBests] = useState({})
  const [yearBests, setYearBests] = useState({})
  const [history, setHistory] = useState([])
  const [trendData, setTrendData] = useState([])
  const [trendGame, setTrendGame] = useState(GAMES[0])
  const [activeTab, setActiveTab] = useState('times')
  useTabQueryParam({
    activeTab,
    setActiveTab,
    allowedTabs: CLUB_RIDER_TABS,
  })
  const [nationalsLevel, setNationalsLevel] = useState(null)
  const [levelBreakdown, setLevelBreakdown] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (combo) loadData()
  }, [combo, selectedYear])

  useEffect(() => {
    if (combo && trendGame) loadTrend()
  }, [combo, trendGame, selectedYear])

  async function loadData() {
    setLoading(true)
    try {
      await Promise.all([loadPersonalBests(), loadYearBests(), loadHistory()])
    } finally {
      setLoading(false)
    }
  }

  async function loadPersonalBests() {
    const { data } = await supabase
      .from('personal_bests')
      .select('*')
      .eq('combo_id', combo.id)
      .lte('season_year', selectedYear)

    const pbMap = buildCarryForwardPbMap(data)
    setPersonalBests(pbMap)

    const timeMap = {}
    Object.values(pbMap).forEach(pb => { timeMap[pb.game] = pb.best_time })
    setNationalsLevel(getNationalsLevel(timeMap))

    const breakdown = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
    Object.values(pbMap).forEach(pb => {
      const l = getLevel(pb.game, pb.best_time)
      if (l !== null) breakdown[l]++
    })
    setLevelBreakdown(breakdown)
  }

  async function loadHistory() {
    const { data: yearEvents } = await supabase
      .from('qualifier_events')
      .select('id')
      .gte('date', `${selectedYear}-01-01`)
      .lte('date', `${selectedYear}-12-31`)

    const yearEventIds = yearEvents?.map(e => e.id) || []
    if (yearEventIds.length === 0) { setHistory([]); return }

    const { data } = await supabase
      .from('qualifier_results')
      .select('*, qualifier_events(date, venue, province, qualifier_number, event_type)')
      .eq('combo_id', combo.id)
      .in('event_id', yearEventIds)
      .order('created_at', { ascending: false })

    const grouped = {}
    data?.forEach(result => {
      const eventId = result.event_id
      if (!grouped[eventId]) grouped[eventId] = { event: result.qualifier_events, results: [] }
      grouped[eventId].results.push({
        ...result,
        game: normalizeGameName(result.game),
      })
    })
    setHistory(Object.values(grouped))
  }

  async function loadYearBests() {
    const { data: yearEvents } = await supabase
      .from('qualifier_events')
      .select('id')
      .gte('date', `${selectedYear}-01-01`)
      .lte('date', `${selectedYear}-12-31`)

    const yearEventIds = yearEvents?.map(e => e.id) || []
    if (yearEventIds.length === 0) {
      setYearBests({})
      return
    }

    const { data } = await supabase
      .from('qualifier_results')
      .select('game, time, is_nt')
      .eq('combo_id', combo.id)
      .in('event_id', yearEventIds)

    const map = {}
    data?.forEach(row => {
      if (row.is_nt === true) return
      const game = normalizeGameName(row.game)
      const bestTime = Number.parseFloat(String(row.time).replace(',', '.'))
      if (!game || Number.isNaN(bestTime)) return
      const current = map[game]
      if (!current || bestTime < current.best_time) {
        map[game] = { game, best_time: bestTime, season_year: selectedYear }
      }
    })
    setYearBests(map)
  }

  async function loadTrend() {
    const { data: yearEvents } = await supabase
      .from('qualifier_events')
      .select('id')
      .gte('date', `${selectedYear}-01-01`)
      .lte('date', `${selectedYear}-12-31`)

    const yearEventIds = yearEvents?.map(e => e.id) || []
    if (yearEventIds.length === 0) { setTrendData([]); return }

    const { data } = await supabase
      .from('qualifier_results')
      .select('time, is_nt, game, qualifier_events(date)')
      .eq('combo_id', combo.id)
      .eq('is_nt', false)
      .in('event_id', yearEventIds)
      .order('qualifier_events(date)', { ascending: true })

    setTrendData(
      data?.filter(d => d.time && !d.is_nt && normalizeGameName(d.game) === trendGame) || [],
    )
  }

  const gamesCovered = Object.keys(personalBests).length
  const gamesAtOrAboveLevel = nationalsLevel !== null
    ? Object.entries(personalBests).filter(([game, pb]) => getLevel(game, pb.best_time) >= nationalsLevel).length
    : 0

  if (loading) return (
    <div className="space-y-3 pt-4">
      <Skeleton className="h-16" />
      <Skeleton className="h-32" />
    </div>
  )

  const sortedEvents = [...history].sort((a, b) => new Date(a.event?.date || 0) - new Date(b.event?.date || 0))
  const eventGameMap = {}
  sortedEvents.forEach(entry => {
    const eventId = entry.results[0]?.event_id
    if (!eventId) return
    eventGameMap[eventId] = {}
    entry.results.forEach(r => { eventGameMap[eventId][normalizeGameName(r.game)] = r })
  })

  return (
    <div className="pt-4 space-y-4">
      {/* Nationals level card */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-200 text-sm font-medium">Nationals Level — {selectedYear}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-bold">
                {nationalsLevel !== null ? `L${nationalsLevel}` : '—'}
              </span>
              {nationalsLevel !== null && (
                <span className="text-green-200 text-sm">({gamesAtOrAboveLevel}/13 games)</span>
              )}
            </div>
            <p className="text-green-200 text-xs mt-1">{gamesCovered}/13 games covered</p>
          </div>
          <Trophy size={40} className="text-green-400 opacity-50" />
        </div>
        <div className="mt-3 flex gap-3 flex-wrap">
          {[0, 1, 2, 3, 4].map(level => (
            <div key={level} className="text-center">
              <div className="text-lg font-bold">{levelBreakdown[level] || 0}</div>
              <div className="text-green-200 text-xs">L{level}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {['times', 'grid', 'history', 'trends'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'times' ? 'Personal Bests' : tab === 'grid' ? 'Qualifier Grid' : tab === 'history' ? 'History' : 'Trends'}
          </button>
        ))}
      </div>

      {/* Personal Bests */}
      {activeTab === 'times' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Game</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Overall PB</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Year Best</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Level</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">To Next</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Season</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {GAMES.map(game => {
                const pb = personalBests[game]
                const yearBest = yearBests[game]
                const level = yearBest ? getLevel(game, yearBest.best_time) : null
                const timeToNext = yearBest ? getTimeToNextLevel(game, yearBest.best_time) : null
                return (
                  <tr key={game} className={`hover:bg-gray-50 ${pb ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        {pb && <Star size={13} className="text-yellow-400 fill-yellow-400" />}
                        {game}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pb ? <span className="font-bold text-gray-800">{pb.best_time?.toFixed(3)}s</span> : <span className="text-gray-400">No time yet</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {yearBest ? <span className="font-bold text-gray-800">{yearBest.best_time?.toFixed(3)}s</span> : <span className="text-gray-400">No time yet</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {level !== null ? (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${LEVEL_STYLES[level]}`}>Level {level}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!pb ? <span className="text-gray-300">—</span> :
                        level === 4 ? <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">Top Level</span> :
                        timeToNext !== null ? <span className="text-xs font-semibold text-orange-600">-{timeToNext.toFixed(3)}s</span> :
                        <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">
                      {isCurrentYearPb(pb) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-2 py-0.5 font-bold border border-green-200">
                          {formatPbDate(pb)}
                          <span className="text-[10px] uppercase tracking-wide">Current</span>
                        </span>
                      ) : (
                        <span>{formatPbDate(pb)}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Qualifier Grid */}
      {activeTab === 'grid' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {sortedEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No qualifier results for {selectedYear}.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse" style={{ minWidth: `${(sortedEvents.length + 2) * 120}px` }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 border-r border-gray-200 min-w-[130px]">Game</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-700 border-r border-gray-200 min-w-[90px]">PB</th>
                    {sortedEvents.map((entry, idx) => {
                      const ev = entry.event
                      const eventId = entry.results[0]?.event_id
                      return (
                        <th key={eventId || idx} className="text-center px-3 py-2 font-semibold text-gray-700 border-r border-gray-200 min-w-[110px]">
                          <div className="text-xs font-semibold">{ev?.qualifier_number ? `Q${ev.qualifier_number}` : '—'}</div>
                          <div className="text-xs font-normal text-gray-500 truncate max-w-[100px]">{ev?.venue || 'Unknown'}</div>
                          <div className="text-xs font-normal text-gray-400">
                            {ev?.date ? new Date(ev.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : ''}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {GAMES.map(game => {
                    const pb = personalBests[game]
                    const pbLevel = pb ? getLevel(game, pb.best_time) : null
                    return (
                      <tr key={game} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800 sticky left-0 bg-white z-10 border-r border-gray-200 whitespace-nowrap">{game}</td>
                        <td className="px-3 py-2.5 text-center border-r border-gray-200">
                          {pb ? (
                            <span className={`inline-block text-xs font-bold px-2 py-1 rounded ${pbLevel !== null ? LEVEL_STYLES[pbLevel] : 'text-gray-500'}`}>
                              {pb.best_time?.toFixed(3)}s
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        {sortedEvents.map((entry, idx) => {
                          const eventId = entry.results[0]?.event_id
                          const result = eventGameMap[eventId]?.[game]
                          const level = result && !result.is_nt ? getLevel(game, result.time) : null
                          return (
                            <td key={eventId || idx} className="px-3 py-2.5 text-center border-r border-gray-200">
                              {result ? (
                                result.is_nt ? (
                                  <span className="inline-block text-xs px-2 py-1 rounded bg-red-50 text-red-400 italic">NT</span>
                                ) : (
                                  <span className={`inline-block text-xs font-medium px-2 py-1 rounded ${level !== null ? LEVEL_STYLES[level] : 'text-gray-500'}`}>
                                    {result.time?.toFixed(3)}s
                                  </span>
                                )
                              ) : <span className="text-gray-200 text-xs">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No qualifier results for {selectedYear}.
            </div>
          ) : (
            history.map((entry, index) => (
              <div key={index} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <p className="font-semibold text-gray-800">{entry.event?.venue}, {entry.event?.province}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(entry.event?.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {entry.event?.qualifier_number && ` · Q${entry.event.qualifier_number}`}
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  {entry.results.map(result => {
                    const level = result.is_nt ? null : getLevel(result.game, result.time)
                    const pb = personalBests[result.game]
                    const isPB = pb && result.time === pb.best_time && !result.is_nt
                    return (
                      <div key={result.id} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isPB && <Star size={13} className="text-yellow-400 fill-yellow-400" />}
                          <span className="text-sm text-gray-700">{result.game}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {result.is_nt ? (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">NT</span>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-gray-800">{result.time?.toFixed(3)}s</span>
                              {level !== null && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_STYLES[level]}`}>L{level}</span>
                              )}
                            </>
                          )}
                          {isPB && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">PB!</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Trends */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select game</label>
            <div className="relative inline-block">
              <select
                value={trendGame}
                onChange={e => setTrendGame(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
              >
                {GAMES.map(game => <option key={game} value={game}>{game}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-600" />
              {trendGame} — {selectedYear}
            </h3>
            {trendData.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No data for {trendGame} in {selectedYear}</div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const maxTime = Math.max(...trendData.map(d => d.time))
                  const minTime = Math.min(...trendData.map(d => d.time))
                  return trendData.map((entry, index) => {
                    const barWidth = ((entry.time - minTime) / (maxTime - minTime + 1)) * 80 + 20
                    const level = getLevel(trendGame, entry.time)
                    return (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-20 flex-shrink-0">
                          {new Date(entry.qualifier_events?.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${100 - barWidth + 20}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700 w-16 text-right flex-shrink-0">{entry.time?.toFixed(3)}s</span>
                        {level !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${LEVEL_STYLES[level]}`}>L{level}</span>
                        )}
                      </div>
                    )
                  })
                })()}
                {trendData.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                    <TrendingUp size={16} className="text-green-600" />
                    {trendData[0].time > trendData[trendData.length - 1].time ? (
                      <span className="text-green-600 font-medium">
                        Improved by {(trendData[0].time - trendData[trendData.length - 1].time).toFixed(3)}s
                      </span>
                    ) : (
                      <span className="text-gray-500">Keep practicing!</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// ManagedClubMemberCard — head-managed member (no login)
// ─────────────────────────────────────────────────────────
function ManagedClubMemberCard({ rider, clubHeadId, onDelete, onUpdated }) {
  const [expanded, setExpanded] = useState(false)
  const [combos, setCombos] = useState([])
  const [horses, setHorses] = useState([])
  const [selectedCombo, setSelectedCombo] = useState(null)
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [loadingCombos, setLoadingCombos] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(rider.rider_name)
  const [editAge, setEditAge] = useState(rider.age_category || '')
  const [editProvince, setEditProvince] = useState(rider.province || '')
  const [savingEdit, setSavingEdit] = useState(false)
  const [showAddCombo, setShowAddCombo] = useState(false)
  const [comboHorseId, setComboHorseId] = useState('')
  const [comboLevel, setComboLevel] = useState(0)
  const [addingCombo, setAddingCombo] = useState(false)

  async function loadExpandedData() {
    setLoadingCombos(true)
    try {
      const [combosData, horsesData] = await Promise.all([
        fetchCombosForManagedRider(rider.id),
        fetchHeadHorses(clubHeadId),
      ])
      setCombos(combosData)
      setHorses(horsesData)
      setSelectedCombo(combosData.find(c => c.is_pinned) || combosData[0] || null)
    } catch {
      toast.error('Error loading member data')
    } finally {
      setLoadingCombos(false)
    }
  }

  async function handleExpand() {
    if (!expanded && combos.length === 0) {
      await loadExpandedData()
    }
    setExpanded(v => !v)
  }

  async function handleSaveEdit() {
    if (!editName.trim()) {
      toast.error('Name is required')
      return
    }
    setSavingEdit(true)
    try {
      const updated = await updateManagedRider(rider.id, {
        rider_name: editName,
        age_category: editAge || null,
        province: editProvince || null,
      })
      onUpdated(updated)
      setEditing(false)
      toast.success('Member updated')
    } catch {
      toast.error('Error updating member')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleAddCombo() {
    if (!comboHorseId) {
      toast.error('Select a horse from your family stable')
      return
    }
    const horse = horses.find(h => h.id === comboHorseId)
    if (!horse) return
    setAddingCombo(true)
    try {
      const combo = await createManagedCombo(clubHeadId, {
        managedRiderId: rider.id,
        horseId: horse.id,
        horseName: horse.name,
        currentLevel: Number(comboLevel),
      })
      const next = [...combos, combo]
      setCombos(next)
      setSelectedCombo(combo)
      setShowAddCombo(false)
      setComboHorseId('')
      toast.success('Combo added')
    } catch (e) {
      console.error(e)
      toast.error('Error adding combo')
    } finally {
      setAddingCombo(false)
    }
  }

  async function handleRemoveCombo(comboId) {
    try {
      await deleteCombo(comboId)
      const next = combos.filter(c => c.id !== comboId)
      setCombos(next)
      if (selectedCombo?.id === comboId) {
        setSelectedCombo(next.find(c => c.is_pinned) || next[0] || null)
      }
      toast.success('Combo removed')
    } catch {
      toast.error('Error removing combo')
    }
  }

  function getHorsePhoto(combo) {
    if (combo.horse_id) return horses.find(h => h.id === combo.horse_id)?.photo_url || null
    return horses.find(h => h.name?.toLowerCase() === combo.horse_name?.toLowerCase())?.photo_url || null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-full overflow-hidden border border-gray-200 bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-green-700">{rider.rider_name?.charAt(0).toUpperCase()}</span>
          </div>
          {editing ? (
            <div className="flex-1 space-y-2">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Name"
              />
              <select
                value={editAge}
                onChange={e => setEditAge(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">Age category</option>
                {AGE_CATEGORIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select
                value={editProvince}
                onChange={e => setEditProvince(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">Province</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-2 py-1 bg-green-600 text-white text-xs rounded-lg"
                >
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} className="px-2 py-1 text-gray-500 text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-gray-800">{rider.rider_name}</p>
              <p className="text-xs text-gray-400">
                {rider.age_category || rider.province || 'No details'}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Edit"
            >
              <Pencil size={15} />
            </button>
          )}
          <button
            onClick={handleExpand}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition text-sm font-medium"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {expanded ? 'Collapse' : 'View Times'}
          </button>
          <button
            onClick={() => onDelete(rider.id)}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
            title="Remove member"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {loadingCombos ? (
            <div className="py-6 space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-32" />
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    if (!showAddCombo && horses.length === 0) {
                      fetchHeadHorses(clubHeadId).then(setHorses)
                    }
                    setShowAddCombo(v => !v)
                  }}
                  className="text-sm font-medium text-green-700 hover:underline"
                >
                  + Add horse/rider combo
                </button>
              </div>

              {showAddCombo && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  {horses.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Add horses to your{' '}
                      <a href="/horses" className="text-green-700 font-medium hover:underline">family stable</a>{' '}
                      first.
                    </p>
                  ) : (
                    <>
                      <select
                        value={comboHorseId}
                        onChange={e => setComboHorseId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Select horse…</option>
                        {horses.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                      <select
                        value={comboLevel}
                        onChange={e => setComboLevel(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {[0, 1, 2, 3, 4].map(l => (
                          <option key={l} value={l}>Level {l}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddCombo}
                        disabled={addingCombo}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60"
                      >
                        {addingCombo ? 'Adding…' : 'Add combo'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {combos.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm">
                  No combos yet. Link a horse from your family stable.
                </div>
              ) : (
                <>
                  <div className="mt-4 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-600">Horse:</span>
                      <div className="flex gap-2 flex-wrap">
                        {combos.map(combo => (
                          <div key={combo.id} className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedCombo(combo)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                                selectedCombo?.id === combo.id
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {getHorsePhoto(combo) ? (
                                <img src={getHorsePhoto(combo)} alt={combo.horse_name} className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-green-300 flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">{combo.horse_name?.charAt(0)}</span>
                                </div>
                              )}
                              {combo.horse_name}
                              {combo.is_pinned && ' ★'}
                            </button>
                            <button
                              onClick={() => handleRemoveCombo(combo.id)}
                              className="text-gray-300 hover:text-red-500 p-0.5"
                              title="Remove combo"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-sm font-medium text-gray-600">Season:</span>
                      <div className="relative inline-block">
                        <select
                          value={selectedYear}
                          onChange={e => setSelectedYear(Number(e.target.value))}
                          className="appearance-none pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white font-medium"
                        >
                          {buildYearOptions().map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  {selectedCombo && (
                    <RiderTimesView combo={selectedCombo} selectedYear={selectedYear} />
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// LinkedClubMemberCard — expandable card for one linked rider
// ─────────────────────────────────────────────────────────
function LinkedClubMemberCard({ link, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  const [combos, setCombos] = useState([])
  const [selectedCombo, setSelectedCombo] = useState(null)
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [horses, setHorses] = useState([])
  const [loadingCombos, setLoadingCombos] = useState(false)

  async function handleExpand() {
    if (!expanded && combos.length === 0) {
      setLoadingCombos(true)
      try {
        const [combosData, horsesRes] = await Promise.all([
          fetchCombosForLinkedRider(link.rider_id),
          supabase
            .from('horses')
            .select('id, name, photo_url, breed, color')
            .eq('user_id', link.rider_id),
        ])
        setCombos(combosData)
        setHorses(horsesRes.data || [])
        setSelectedCombo(combosData.find(c => c.is_pinned) || combosData[0] || null)
      } catch {
        toast.error('Error loading rider data')
      } finally {
        setLoadingCombos(false)
      }
    }
    setExpanded(v => !v)
  }

  function getHorsePhoto(combo) {
    if (combo.horse_id) return horses.find(h => h.id === combo.horse_id)?.photo_url || null
    return horses.find(h => h.name?.toLowerCase() === combo.horse_name?.toLowerCase())?.photo_url || null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border border-gray-200 bg-green-100 flex items-center justify-center flex-shrink-0">
            {link.rider?.profile_photo_url ? (
              <img src={link.rider.profile_photo_url} alt={link.rider.rider_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-green-700">{link.rider?.rider_name?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{link.rider?.rider_name}</p>
            <p className="text-xs text-gray-400">
              {link.rider?.age_category || link.rider?.province || 'No details'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExpand}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition text-sm font-medium"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {expanded ? 'Collapse' : 'View Times'}
          </button>
          <button
            onClick={() => onRemove(link.id)}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
            title="Remove from club"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {loadingCombos ? (
            <div className="py-6 space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-32" />
            </div>
          ) : combos.length === 0 ? (
            <div className="py-6 text-center text-gray-400 text-sm">This rider has no horse/rider combos yet.</div>
          ) : (
            <>
              {/* Combo + Year selectors */}
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-600">Horse:</span>
                  <div className="flex gap-2 flex-wrap">
                    {combos.map(combo => (
                      <button
                        key={combo.id}
                        onClick={() => setSelectedCombo(combo)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                          selectedCombo?.id === combo.id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {getHorsePhoto(combo) ? (
                          <img src={getHorsePhoto(combo)} alt={combo.horse_name} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-green-300 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{combo.horse_name?.charAt(0)}</span>
                          </div>
                        )}
                        {combo.horse_name}
                        {combo.is_pinned && ' ★'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm font-medium text-gray-600">Season:</span>
                  <div className="relative inline-block">
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      className="appearance-none pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white font-medium"
                    >
                      {buildYearOptions().map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Times view for selected combo */}
              {selectedCombo && (
                <RiderTimesView combo={selectedCombo} selectedYear={selectedYear} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────
export default function ClubRiders() {
  const { profile, isClubHead } = useAuth()
  const [managedRiders, setManagedRiders] = useState([])
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAge, setNewAge] = useState('')
  const [newProvince, setNewProvince] = useState(profile?.province || '')
  const [creatingMember, setCreatingMember] = useState(false)

  useEffect(() => {
    if (profile) {
      loadAll()
    }
  }, [profile])

  async function loadAll() {
    setLoading(true)
    try {
      await Promise.all([fetchManaged(), fetchLinks()])
    } finally {
      setLoading(false)
    }
  }

  async function fetchManaged() {
    try {
      const list = await fetchManagedRiders(profile.id)
      setManagedRiders(list)
    } catch (e) {
      if (e?.code === '42P01') {
        console.warn('club_managed_riders table not found — run club_managed_riders.sql')
      } else {
        toast.error('Error loading family members')
      }
      setManagedRiders([])
    }
  }

  async function fetchLinks() {
    try {
      const { data: linksData } = await supabase
        .from('club_member_links')
        .select('id, rider_id, status, created_at')
        .eq('club_head_id', profile.id)
        .order('created_at', { ascending: false })

      if (!linksData || linksData.length === 0) {
        setLinks([])
        return
      }

      const riderIds = linksData.map(l => l.rider_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, rider_name, province, age_category, profile_photo_url')
        .in('id', riderIds)

      const profileMap = {}
      profiles?.forEach(p => { profileMap[p.id] = p })

      setLinks(linksData.map(link => ({
        ...link,
        rider: profileMap[link.rider_id] || null
      })))
    } catch {
      setLinks([])
    }
  }

  async function handleCreateMember(e) {
    e.preventDefault()
    if (!newName.trim()) {
      toast.error('Name is required')
      return
    }
    if (!newAge) {
      toast.error('Age category is required')
      return
    }
    setCreatingMember(true)
    try {
      const created = await createManagedRider(profile.id, {
        rider_name: newName,
        age_category: newAge,
        province: newProvince || profile.province,
      })
      setManagedRiders(prev => [...prev, created].sort((a, b) => a.rider_name.localeCompare(b.rider_name)))
      setNewName('')
      setNewAge('')
      setNewProvince(profile.province || '')
      toast.success(`${created.rider_name} added to your club/family`)
    } catch (e) {
      console.error(e)
      if (e?.code === '42P01') {
        toast.error('Run club_managed_riders.sql migration in Supabase first.')
      } else {
        toast.error('Error adding member')
      }
    } finally {
      setCreatingMember(false)
    }
  }

  async function handleDeleteManaged(id) {
    if (!window.confirm('Remove this member? Their combos and times will be deleted.')) return
    try {
      await deleteManagedRider(id)
      setManagedRiders(prev => prev.filter(r => r.id !== id))
      toast.success('Member removed')
    } catch {
      toast.error('Error removing member')
    }
  }

  // Live search — debounced
  async function handleSearch(query) {
    const q = query.trim()
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, rider_name, province, age_category, profile_photo_url')
        .eq('role', 'user')
        .ilike('rider_name', `%${q}%`)
        .limit(8)

      const linkedIds = new Set(links.map(l => l.rider_id))
      setSearchResults((data || []).filter(p => p.id !== profile.id && !linkedIds.has(p.id)))
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (!searchQuery) { setSearchResults([]); return }
    const timer = setTimeout(() => handleSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, links])

  async function sendRequest(rider) {
    setSending(s => ({ ...s, [rider.id]: true }))
    try {
      const { error: linkError } = await supabase
        .from('club_member_links')
        .insert({
          club_head_id: profile.id,
          rider_id: rider.id,
          status: 'pending'
        })

      if (linkError) {
        if (linkError.code === '23505') {
          toast.error('You already sent a request to this rider.')
        } else if (linkError.code === '42P01') {
          toast.error('Table not set up yet. Please run the club_member_links.sql migration in Supabase.')
        } else {
          toast.error(`Error: ${linkError.message}`)
        }
        return
      }

      // Notify the rider
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: rider.id,
        type: 'club_link_request',
        message: `${profile.rider_name} wants to add you to their club/family. Check your Profile to accept or decline.`,
        link: '/profile#my-club-family'
      })
      if (notifError) {
        console.warn('Rider notification insert failed:', notifError.message)
      }

      toast.success(`Request sent to ${rider.rider_name}!`)
      setSearchResults(r => r.filter(p => p.id !== rider.id))
      fetchLinks()
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Unexpected error sending request.')
    } finally {
      setSending(s => ({ ...s, [rider.id]: false }))
    }
  }

  async function withdrawRequest(linkId) {
    try {
      const { error } = await supabase
        .from('club_member_links')
        .delete()
        .eq('id', linkId)

      if (error) throw error
      toast.success('Request withdrawn')
      setLinks(prev => prev.filter(l => l.id !== linkId))
    } catch (error) {
      toast.error('Error withdrawing request')
    }
  }

  async function removeRider(linkId) {
    try {
      const { error } = await supabase
        .from('club_member_links')
        .delete()
        .eq('id', linkId)

      if (error) throw error
      toast.success('Rider removed from club')
      setLinks(prev => prev.filter(l => l.id !== linkId))
    } catch (error) {
      toast.error('Error removing rider')
    }
  }

  if (!isClubHead) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>This page is for Club/Family Heads only.</p>
      </div>
    )
  }

  const acceptedLinks = links.filter(l => l.status === 'accepted')
  const pendingLinks = links.filter(l => l.status === 'pending')
  const rejectedLinks = links.filter(l => l.status === 'rejected')
  const hasMembers = managedRiders.length > 0 || acceptedLinks.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Club Riders"
        description="Add family or club members and link them to horses in your family stable"
      />

      {/* Search / Add Rider */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <UserPlus size={18} className="text-gray-400" />
          Add family / club member
        </h2>
        <form onSubmit={handleCreateMember} className="space-y-3 mb-4">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Member name *"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
          <select
            value={newAge}
            onChange={e => setNewAge(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
            required
          >
            <option value="">Age category *</option>
            {AGE_CATEGORIES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={newProvince}
            onChange={e => setNewProvince(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">Province (optional)</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            type="submit"
            disabled={creatingMember}
            className="px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60"
          >
            {creatingMember ? 'Adding…' : 'Add member'}
          </button>
        </form>
        <p className="text-xs text-gray-400 mb-4">
          No separate login. Add horses under{' '}
          <a href="/horses" className="text-green-700 font-medium hover:underline">Family stable</a>
          , then link when creating combos.
        </p>
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 mb-2"
        >
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Advanced: link registered rider
        </button>
        {showAdvanced && (
        <>
        <div className="relative">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search for a Club/Family Rider by name…"
              className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              autoComplete="off"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {searchQuery && !searching && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
              {searchResults.map(rider => (
                <div
                  key={rider.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 bg-green-100 flex items-center justify-center flex-shrink-0">
                      {rider.profile_photo_url ? (
                        <img src={rider.profile_photo_url} alt={rider.rider_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-green-700">{rider.rider_name?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{rider.rider_name}</p>
                      <p className="text-xs text-gray-400">{rider.age_category || rider.province || '—'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => sendRequest(rider)}
                    disabled={!!sending[rider.id]}
                    className="ml-3 flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-60"
                  >
                    <UserPlus size={13} />
                    {sending[rider.id] ? 'Sending…' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 px-4 py-3 text-sm text-gray-400">
              No Club/Family Riders found matching "{searchQuery.trim()}".
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Search for riders who already have an account.
        </p>
        </>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !hasMembers && links.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Add a family or club member above to get started."
        />
      ) : (
        <div className="space-y-6">

          {managedRiders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-green-600" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Your members ({managedRiders.length})
                </h2>
              </div>
              <div className="space-y-3">
                {managedRiders.map(rider => (
                  <ManagedClubMemberCard
                    key={rider.id}
                    rider={rider}
                    clubHeadId={profile.id}
                    onDelete={handleDeleteManaged}
                    onUpdated={(updated) => {
                      setManagedRiders(prev =>
                        prev.map(r => r.id === updated.id ? updated : r)
                          .sort((a, b) => a.rider_name.localeCompare(b.rider_name))
                      )
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Accepted links */}
          {acceptedLinks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <UserCheck size={16} className="text-green-600" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Active Riders ({acceptedLinks.length})
                </h2>
              </div>
              <div className="space-y-3">
                {acceptedLinks.map(link => (
                  <LinkedClubMemberCard
                    key={link.id}
                    link={link}
                    onRemove={removeRider}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending requests */}
          {pendingLinks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Hourglass size={16} className="text-yellow-500" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Pending Requests ({pendingLinks.length})
                </h2>
              </div>
              <div className="space-y-3">
                {pendingLinks.map(link => (
                  <div key={link.id} className="bg-white rounded-xl border border-yellow-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-yellow-200 bg-yellow-100 flex items-center justify-center flex-shrink-0">
                        {link.rider?.profile_photo_url ? (
                          <img src={link.rider.profile_photo_url} alt={link.rider.rider_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-yellow-700">{link.rider?.rider_name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{link.rider?.rider_name}</p>
                        <p className="text-xs text-yellow-600">⏳ Awaiting rider's acceptance</p>
                      </div>
                    </div>
                    <button
                      onClick={() => withdrawRequest(link.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 transition"
                    >
                      Withdraw
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejected (dismissed) */}
          {rejectedLinks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Declined ({rejectedLinks.length})
                </h2>
              </div>
              <div className="space-y-3">
                {rejectedLinks.map(link => (
                  <div key={link.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-gray-500">{link.rider?.rider_name?.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-600 text-sm">{link.rider?.rider_name}</p>
                        <p className="text-xs text-gray-400">Request declined</p>
                      </div>
                    </div>
                    <button
                      onClick={() => withdrawRequest(link.id)}
                      className="text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
