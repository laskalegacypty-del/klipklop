import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { QUALIFIER_GAMES } from '../lib/constants'
import { entryKey, stripDayAnnotation } from '../lib/runningListParser'
import EventDayTimeModal from '../components/event-day/EventDayTimeModal'
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

const CATEGORY_COLORS = {
  S: 'bg-purple-100 text-purple-700',
  J: 'bg-blue-100 text-blue-700',
  C: 'bg-pink-100 text-pink-700',
  V: 'bg-amber-100 text-amber-700',
}

function entryStatus(entry, enteredTimes, events) {
  const key = entryKey(entry)
  const timesForEntry = enteredTimes[key]
  if (!timesForEntry) return 'empty'
  let totalGames = 0
  let filledGames = 0
  for (const event of events) {
    const games = QUALIFIER_GAMES[event.qualifier_number] || []
    totalGames += games.length
    const eventTimes = timesForEntry[event.id] || {}
    for (const game of games) {
      const g = eventTimes[game]
      if (g && (g.is_nt || (g.time && g.time.trim() !== ''))) filledGames++
    }
  }
  if (filledGames === 0) return 'empty'
  if (filledGames < totalGames) return 'partial'
  return 'complete'
}

function StatusDot({ status }) {
  const colors = {
    empty: 'bg-gray-300',
    partial: 'bg-yellow-400',
    complete: 'bg-green-500',
  }
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
        const hasValue = g.is_nt || (g.time && g.time.trim() !== '')
        if (!hasValue) continue
        rows.push({
          entry_key: ek,
          event_id: event.id,
          game,
          time: g.is_nt ? null : g.time,
          is_nt: g.is_nt,
        })
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
  const [timeModalEntry, setTimeModalEntry] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const syncTimerRef = useRef(null)
  const enteredTimesRef = useRef(enteredTimes)
  const helperLabelRef = useRef(helperLabel)

  useEffect(() => { enteredTimesRef.current = enteredTimes }, [enteredTimes])
  useEffect(() => { helperLabelRef.current = helperLabel }, [helperLabel])

  const activeEvents = useMemo(() => {
    if (!session) return []
    const events = [session.primary_event, session.is_back_to_back ? session.secondary_event : null].filter(Boolean)
    return events
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
        await syncHelperTimes(token, {
          times,
          helperLabel: helperLabelRef.current,
          deviceId,
        })
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
    return enteredTimes[entryKey(entry)]?.[event.id]?.[game] || { time: '', is_nt: false }
  }

  function setGameEntry(entry, event, game, values) {
    const key = entryKey(entry)
    setEnteredTimes(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [event.id]: {
          ...(prev[key]?.[event.id] || {}),
          [game]: { ...(prev[key]?.[event.id]?.[game] || { time: '', is_nt: false }), ...values },
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

      <div className="space-y-3 pb-8">
        {selectedEntries.map(entry => {
          const status = entryStatus(entry, enteredTimes, activeEvents)
          return (
            <div
              key={entryKey(entry)}
              className={`bg-white border rounded-xl overflow-hidden ${status === 'complete' ? 'border-green-300' : status === 'partial' ? 'border-yellow-300' : 'border-gray-200'}`}
            >
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                    #{entry.runNumber}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{stripDayAnnotation(entry.riderName)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[entry.category] || 'bg-gray-100'}`}>
                        {entry.category}{entry.level}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{entry.horseName} · Group {entry.group}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusDot status={status} />
                  <button
                    type="button"
                    onClick={() => setTimeModalEntry(entry)}
                    className="text-xs font-semibold text-white bg-green-700 hover:bg-green-800 px-3 py-2 rounded-lg transition"
                  >
                    Enter Times
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <EventDayTimeModal
        entry={timeModalEntry}
        activeEvents={activeEvents}
        getGameEntry={getGameEntry}
        setGameEntry={setGameEntry}
        onClose={() => setTimeModalEntry(null)}
      />
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
