import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { QUALIFIER_GAMES, normalizeGameName } from '../lib/constants'
import { getLevel, getTimeToNextLevel } from '../lib/matrix'
import { entryKey, stripDayAnnotation } from '../lib/runningListParser'
import { Skeleton } from '../components/ui'
import {
  fetchEventDaySession,
  syncHelperTimes,
  getOrCreateDeviceId,
  loadHelperLocalTimes,
  saveHelperLocalTimes,
  getHelperLabel,
  setHelperLabel,
} from '../lib/eventDayShare'
import { APP_NAME, APP_LOGO_SRC, APP_TAGLINE } from '../constants/branding'
import { ChevronDown, ChevronRight } from 'lucide-react'

const CATEGORY_COLORS = {
  S: 'bg-purple-100 text-purple-700',
  J: 'bg-blue-100 text-blue-700',
  C: 'bg-pink-100 text-pink-700',
  V: 'bg-amber-100 text-amber-700',
}

const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
}

function getBestTime(t1, t2) {
  const n1 = t1 ? parseFloat(t1) : NaN
  const n2 = t2 ? parseFloat(t2) : NaN
  const valid = [n1, n2].filter(n => !isNaN(n) && n > 0)
  return valid.length ? Math.min(...valid) : null
}

function entryStatus(entry, enteredTimes, events) {
  const key = entryKey(entry)
  const timesForEntry = enteredTimes[key]
  if (!timesForEntry) return 'empty'
  let total = 0
  let filled = 0
  for (const event of events) {
    const games = QUALIFIER_GAMES[event.qualifier_number] || []
    total += games.length
    const eventTimes = timesForEntry[event.id] || {}
    for (const game of games) {
      const g = eventTimes[game]
      if (!g) continue
      if (g.is_nt || getBestTime(g.time1, g.time2) !== null) filled++
    }
  }
  if (filled === 0) return 'empty'
  if (filled < total) return 'partial'
  return 'complete'
}

function StatusDot({ status }) {
  const colors = { empty: 'bg-gray-300', partial: 'bg-yellow-400', complete: 'bg-green-500' }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[status] || colors.empty}`} />
}

function eventLabel(event) {
  if (!event) return '—'
  return `Q${event.qualifier_number} · ${event.venue} · ${new Date(event.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`
}

function flattenTimesForSync(enteredTimes, activeEvents) {
  const rows = []
  for (const [ek, byEvent] of Object.entries(enteredTimes)) {
    for (const event of activeEvents) {
      const games = QUALIFIER_GAMES[event.qualifier_number] || []
      const eventTimes = byEvent[event.id] || {}
      for (const game of games) {
        const g = eventTimes[game]
        if (!g) continue
        if (g.is_nt) {
          rows.push({ entry_key: ek, event_id: event.id, game, time: null, is_nt: true })
        } else {
          const best = getBestTime(g.time1, g.time2)
          if (best !== null) {
            rows.push({ entry_key: ek, event_id: event.id, game, time: best, is_nt: false })
          }
        }
      }
    }
  }
  return rows
}

export default function EventDayHelper() {
  const { token } = useParams()
  const deviceId = useMemo(() => getOrCreateDeviceId(), [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(null)
  const [helperLabel, setHelperLabelState] = useState(() => getHelperLabel(token))
  const [enteredTimes, setEnteredTimes] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [expandedKey, setExpandedKey] = useState(null)

  const syncTimerRef = useRef(null)
  const enteredTimesRef = useRef(enteredTimes)
  const helperLabelRef = useRef(helperLabel)

  useEffect(() => { enteredTimesRef.current = enteredTimes }, [enteredTimes])
  useEffect(() => { helperLabelRef.current = helperLabel }, [helperLabel])

  const activeEvents = useMemo(() => {
    if (!session) return []
    return [session.primary_event, session.is_back_to_back ? session.secondary_event : null].filter(Boolean)
  }, [session])

  const selectedEntries = useMemo(() => {
    if (!session?.entries?.length) return []
    const keys = new Set(session.selected_entry_keys || [])
    return session.entries.filter(e => keys.has(entryKey(e)))
  }, [session])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchEventDaySession(token)
        if (cancelled) return
        setSession(data.session)
        const local = loadHelperLocalTimes(token, deviceId)
        setEnteredTimes(local.enteredTimes)
        if (local.helperLabel) setHelperLabelState(local.helperLabel)
      } catch (err) {
        if (!cancelled) {
          setError({
            title: err.status === 410 ? 'Link unavailable' : 'Something went wrong',
            message: err.message || 'Could not load event session.',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (token) load()
    return () => { cancelled = true }
  }, [token, deviceId])

  const scheduleSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(async () => {
      if (!token || !session) return
      const times = flattenTimesForSync(enteredTimesRef.current, activeEvents)
      if (!times.length) return
      setSyncing(true)
      try {
        await syncHelperTimes(token, { times, helperLabel: helperLabelRef.current, deviceId })
      } catch (err) {
        console.error(err)
      } finally {
        setSyncing(false)
      }
    }, 800)
  }, [token, session, activeEvents, deviceId])

  useEffect(() => {
    if (!session) return
    saveHelperLocalTimes(token, deviceId, enteredTimes, helperLabel)
    scheduleSync()
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [enteredTimes, helperLabel, session, token, deviceId, scheduleSync])

  function getGameEntry(entry, event, game) {
    const g = enteredTimes[entryKey(entry)]?.[event.id]?.[game]
    if (!g) return { time1: '', time2: '', is_nt: false }
    // handle old single-time format gracefully
    if (g.time !== undefined && g.time1 === undefined) {
      return { time1: g.time || '', time2: '', is_nt: g.is_nt || false }
    }
    return { time1: g.time1 || '', time2: g.time2 || '', is_nt: g.is_nt || false }
  }

  function setGameEntry(entry, event, game, values) {
    const key = entryKey(entry)
    setEnteredTimes(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [event.id]: {
          ...(prev[key]?.[event.id] || {}),
          [game]: { ...(prev[key]?.[event.id]?.[game] || { time1: '', time2: '', is_nt: false }), ...values },
        },
      },
    }))
  }

  function handleLabelChange(value) {
    setHelperLabelState(value)
    setHelperLabel(token, value)
  }

  if (loading) {
    return (
      <HelperShell>
        <Skeleton className="h-20 mb-4" />
        <Skeleton className="h-48" />
      </HelperShell>
    )
  }

  if (error) {
    return (
      <HelperShell>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">{error.title}</h1>
          <p className="text-gray-600 text-sm leading-relaxed">{error.message}</p>
        </div>
      </HelperShell>
    )
  }

  return (
    <HelperShell>
      <div className="bg-green-800 text-white rounded-xl px-4 py-4 mb-4">
        <p className="text-green-200 text-xs font-semibold uppercase tracking-wide">Event Day Helper</p>
        {activeEvents.map(ev => (
          <p key={ev.id} className="font-bold text-sm">{eventLabel(ev)}</p>
        ))}
        <p className="text-green-200 text-xs mt-2">
          {selectedEntries.length} rider{selectedEntries.length !== 1 ? 's' : ''} to track
          {syncing ? ' · syncing…' : ''}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <label className="block text-xs font-semibold text-gray-600 mb-1">Your name (optional)</label>
        <input
          type="text"
          value={helperLabel}
          onChange={e => handleLabelChange(e.target.value)}
          placeholder="e.g. Mom, Dad, Trainer"
          className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <p className="text-xs text-gray-400 mt-1">Times save on this device and sync when online.</p>
      </div>

      <div className="space-y-2 pb-8">
        {selectedEntries.map(entry => {
          const ek = entryKey(entry)
          const status = entryStatus(entry, enteredTimes, activeEvents)
          const isOpen = expandedKey === ek

          return (
            <div
              key={ek}
              className={`bg-white border rounded-xl overflow-hidden transition-colors ${
                status === 'complete' ? 'border-green-300' :
                status === 'partial' ? 'border-yellow-300' : 'border-gray-200'
              }`}
            >
              {/* Rider header */}
              <button
                type="button"
                onClick={() => setExpandedKey(isOpen ? null : ek)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                    #{entry.runNumber}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{stripDayAnnotation(entry.riderName)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[entry.category] || 'bg-gray-100'}`}>
                        {entry.category}{entry.level}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{entry.horseName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusDot status={status} />
                  {isOpen
                    ? <ChevronDown size={16} className="text-gray-400" />
                    : <ChevronRight size={16} className="text-gray-400" />
                  }
                </div>
              </button>

              {/* Expanded games */}
              {isOpen && (
                <div className="border-t border-gray-100 px-4 pt-3 pb-4 space-y-6">
                  {activeEvents.map(event => {
                    const games = QUALIFIER_GAMES[event.qualifier_number] || []
                    return (
                      <div key={event.id}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-green-700 mb-3">
                          Q{event.qualifier_number} · {event.venue}
                        </p>
                        <div className="space-y-4">
                          {games.map(game => {
                            const g = getGameEntry(entry, event, game)
                            const normGame = normalizeGameName(game) || game
                            const pb = entry.pbs?.[normGame]
                            const yearPb = entry.year_pbs?.[normGame]
                            const pbLevel = pb != null ? getLevel(normGame, parseFloat(pb)) : null
                            const yearPbLevel = yearPb != null ? getLevel(normGame, parseFloat(yearPb)) : null
                            const best = g.is_nt ? null : getBestTime(g.time1, g.time2)
                            const level = best !== null ? getLevel(normGame, best) : null
                            const timeToNext = best !== null && level !== null && level < 4
                              ? getTimeToNextLevel(normGame, best)
                              : null

                            return (
                              <div key={game} className="bg-gray-50 rounded-xl p-3 space-y-2">
                                {/* Game name + PB stats */}
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-xs font-bold text-gray-800 pt-0.5">{game}</span>
                                  <div className="flex gap-3 text-right flex-shrink-0">
                                    {pb != null && (
                                      <div>
                                        <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                                          {yearPb != null && parseFloat(yearPb).toFixed(3) === parseFloat(pb).toFixed(3) ? 'PB (this year)' : 'PB'}
                                        </div>
                                        <div className="text-xs font-bold tabular-nums text-gray-700">
                                          {parseFloat(pb).toFixed(3)}s
                                          {pbLevel !== null && (
                                            <span className={`ml-1 text-[10px] px-1 py-0.5 rounded ${LEVEL_STYLES[pbLevel]}`}>L{pbLevel}</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {yearPb != null && parseFloat(yearPb).toFixed(3) !== parseFloat(pb).toFixed(3) && (
                                      <div>
                                        <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Year best</div>
                                        <div className="text-xs font-bold tabular-nums text-gray-700">
                                          {parseFloat(yearPb).toFixed(3)}s
                                          {yearPbLevel !== null && (
                                            <span className={`ml-1 text-[10px] px-1 py-0.5 rounded ${LEVEL_STYLES[yearPbLevel]}`}>L{yearPbLevel}</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Time inputs */}
                                {g.is_nt ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center text-xs font-semibold text-red-500">
                                      NT — No Time
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setGameEntry(entry, event, game, { is_nt: false, time1: '', time2: '' })}
                                      className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white transition"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                      <label className="block text-[10px] text-gray-400 mb-1">Round 1</label>
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.001"
                                        min="0"
                                        placeholder="0.000"
                                        value={g.time1}
                                        onChange={e => setGameEntry(entry, event, game, { time1: e.target.value })}
                                        className="w-full h-10 px-2 rounded-lg border border-gray-300 bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500 tabular-nums"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-[10px] text-gray-400 mb-1">Round 2</label>
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.001"
                                        min="0"
                                        placeholder="0.000"
                                        value={g.time2}
                                        onChange={e => setGameEntry(entry, event, game, { time2: e.target.value })}
                                        className="w-full h-10 px-2 rounded-lg border border-gray-300 bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500 tabular-nums"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setGameEntry(entry, event, game, { is_nt: true, time1: '', time2: '' })}
                                      className="flex-shrink-0 h-10 text-xs font-semibold text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 bg-white rounded-lg px-2 transition"
                                    >
                                      NT
                                    </button>
                                  </div>
                                )}

                                {/* Live result */}
                                {(best !== null || g.is_nt) && (
                                  <div className="flex items-center gap-2 pt-0.5">
                                    {g.is_nt ? (
                                      <span className="text-xs font-semibold text-red-500">No time recorded</span>
                                    ) : (
                                      <>
                                        <span className="text-xs font-bold text-green-700 tabular-nums">Best: {best.toFixed(3)}s</span>
                                        {level !== null && (
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${LEVEL_STYLES[level]}`}>L{level}</span>
                                        )}
                                        {timeToNext !== null && (
                                          <span className="text-[10px] text-orange-600 font-medium">−{timeToNext.toFixed(3)}s to L{level + 1}</span>
                                        )}
                                        {level === 4 && (
                                          <span className="text-[10px] font-bold text-red-600">Top level!</span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </HelperShell>
  )
}

function HelperShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="h-10 w-10 object-contain" />
          <div>
            <p className="text-base font-bold text-green-900">{APP_NAME}</p>
            <p className="text-xs text-gray-500">{APP_TAGLINE}</p>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
