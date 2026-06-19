import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { normalizeGameName } from '../../lib/constants'
import { getLevel, getNationalsLevel, getTimeToNextLevel } from '../../lib/matrix'
import { Skeleton } from '../ui'
import { Trophy, Star, ChevronDown, TrendingUp } from 'lucide-react'
import { useTabQueryParam } from '../../lib/useTabQueryParam'
import {
  GAMES,
  LEVEL_STYLES,
  TIMES_VIEW_TABS,
  buildCarryForwardPbMap,
  formatPbDate,
  isCurrentYearPb,
  buildTrendDataFromRows,
} from '../../lib/timesViewHelpers'

export default function SharedTimesView({
  combo,
  selectedYear,
  preloaded = null,
  tabQueryKey = 'tab',
  showPoweredBy = false,
}) {
  const [personalBests, setPersonalBests] = useState(preloaded?.personal_bests || {})
  const [yearBests, setYearBests] = useState(preloaded?.year_bests || {})
  const [history, setHistory] = useState(preloaded?.history || [])
  const [trendRows, setTrendRows] = useState(preloaded?.trend_rows || [])
  const [trendGame, setTrendGame] = useState(GAMES[0])
  const [activeTab, setActiveTab] = useState('times')
  const [nationalsLevel, setNationalsLevel] = useState(null)
  const [levelBreakdown, setLevelBreakdown] = useState({})
  const [loading, setLoading] = useState(!preloaded)

  useTabQueryParam({
    activeTab,
    setActiveTab,
    allowedTabs: TIMES_VIEW_TABS,
    paramName: tabQueryKey,
  })

  useEffect(() => {
    if (preloaded) {
      applyStats(preloaded.personal_bests || {}, preloaded.year_bests || {})
      setHistory(preloaded.history || [])
      setTrendRows(preloaded.trend_rows || [])
      setLoading(false)
      return
    }
    if (combo) loadData()
  }, [combo, selectedYear, preloaded])

  async function loadData() {
    setLoading(true)
    try {
      const { data: yearEvents } = await supabase
        .from('qualifier_events')
        .select('id')
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`)

      const yearEventIds = yearEvents?.map(e => e.id) || []

      const [pbRes, resultsRes] = await Promise.all([
        supabase
          .from('personal_bests')
          .select('*')
          .eq('combo_id', combo.id)
          .lte('season_year', selectedYear),
        yearEventIds.length > 0
          ? supabase
            .from('qualifier_results')
            .select('*, qualifier_events(date, venue, province, qualifier_number, event_type)')
            .eq('combo_id', combo.id)
            .in('event_id', yearEventIds)
            .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])

      const pbMap = buildCarryForwardPbMap(pbRes.data)
      const ybMap = {}
      const rows = []
      const grouped = {}

      resultsRes.data?.forEach(result => {
        const eventId = result.event_id
        if (!grouped[eventId]) {
          grouped[eventId] = { event: result.qualifier_events, results: [] }
        }
        grouped[eventId].results.push({
          ...result,
          game: normalizeGameName(result.game),
        })

        if (!result.is_nt && result.time != null) {
          const game = normalizeGameName(result.game)
          const bestTime = Number.parseFloat(String(result.time).replace(',', '.'))
          if (game && !Number.isNaN(bestTime)) {
            const current = ybMap[game]
            if (!current || bestTime < current.best_time) {
              ybMap[game] = { game, best_time: bestTime, season_year: selectedYear }
            }
            rows.push({
              game,
              time: bestTime,
              date: result.qualifier_events?.date || null,
            })
          }
        }
      })

      applyStats(pbMap, ybMap)
      setHistory(Object.values(grouped))
      setTrendRows(rows)
    } finally {
      setLoading(false)
    }
  }

  const trendData = useMemo(
    () => buildTrendDataFromRows(trendRows, trendGame),
    [trendRows, trendGame],
  )

  function applyStats(pbMap, ybMap) {
    setPersonalBests(pbMap)
    setYearBests(ybMap)
    const timeMap = {}
    Object.values(pbMap).forEach(pb => { timeMap[pb.game] = pb.best_time })
    setNationalsLevel(getNationalsLevel(timeMap))
    const breakdown = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
    Object.values(pbMap).forEach(pb => {
      const level = getLevel(pb.game, pb.best_time)
      if (level !== null) breakdown[level]++
    })
    setLevelBreakdown(breakdown)
  }

  const gamesCovered = Object.keys(personalBests).length
  const gamesAtOrAboveLevel = nationalsLevel !== null
    ? Object.entries(personalBests).filter(([game, pb]) => getLevel(game, pb.best_time) >= nationalsLevel).length
    : 0

  if (loading) {
    return (
      <div className="space-y-3 pt-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-32" />
      </div>
    )
  }

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
      {showPoweredBy && (
        <p className="text-xs text-gray-400 text-center">Powered by KlipKlop</p>
      )}

      <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-200 text-sm font-medium">Nationals Level — {selectedYear}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-bold">
                {nationalsLevel !== null ? `L${nationalsLevel}` : '—'}
              </span>
              {nationalsLevel !== null && (
                <span className="text-green-200 text-sm">
                  ({gamesAtOrAboveLevel}/13 games)
                </span>
              )}
            </div>
            <p className="text-green-200 text-xs mt-1">
              {gamesCovered}/13 games covered
            </p>
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

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {TIMES_VIEW_TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'times' ? 'Personal Bests' : tab === 'grid' ? 'Qualifier Grid' : tab === 'history' ? 'History' : 'Trends'}
          </button>
        ))}
      </div>

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
                      {pb ? (
                        <span className="font-bold text-gray-800">{pb.best_time?.toFixed(3)}s</span>
                      ) : (
                        <span className="text-gray-400">No time yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {yearBest ? (
                        <span className="font-bold text-gray-800">{yearBest.best_time?.toFixed(3)}s</span>
                      ) : (
                        <span className="text-gray-400">No time yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {level !== null ? (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${LEVEL_STYLES[level]}`}>
                          Level {level}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!pb ? (
                        <span className="text-gray-300">—</span>
                      ) : level === 4 ? (
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">Top Level</span>
                      ) : timeToNext !== null ? (
                        <span className="text-xs font-semibold text-orange-600">-{timeToNext.toFixed(3)}s</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">
                      {isCurrentYearPb(pb, selectedYear) ? (
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
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
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
                              ) : (
                                <span className="text-gray-200 text-xs">—</span>
                              )}
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
