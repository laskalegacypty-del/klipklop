import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { PageHeader, Card, CardContent, Skeleton } from '../../components/ui'
import { History, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function EventDayHistory() {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [expanded, setExpanded] = useState(new Set())

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('event_day_results')
        .select(`
          id, combo_id, event_id, game, time, is_nt,
          level_entered, level_achieved, run_number,
          rider_name, horse_name, saved_at,
          qualifier_events(id, venue, date, qualifier_number)
        `)
        .order('saved_at', { ascending: false })

      if (error) {
        toast.error('Could not load event day history')
        console.error(error)
        setLoading(false)
        return
      }

      // Group by event_id then by rider (run_number + rider_name + horse_name)
      const byEvent = new Map()
      for (const row of data || []) {
        const eventId = row.event_id
        if (!byEvent.has(eventId)) {
          byEvent.set(eventId, {
            event: row.qualifier_events,
            latestSave: row.saved_at,
            riders: new Map(),
          })
        }
        const session = byEvent.get(eventId)
        if (row.saved_at > session.latestSave) session.latestSave = row.saved_at

        const riderKey = `${row.run_number}:${row.rider_name}:${row.horse_name}`
        if (!session.riders.has(riderKey)) {
          session.riders.set(riderKey, {
            runNumber: row.run_number,
            riderName: row.rider_name,
            horseName: row.horse_name,
            levelEntered: row.level_entered,
            games: [],
          })
        }
        session.riders.get(riderKey).games.push({
          game: row.game,
          time: row.time,
          is_nt: row.is_nt,
          level_achieved: row.level_achieved,
        })
      }

      const sorted = Array.from(byEvent.values()).sort(
        (a, b) => new Date(b.latestSave) - new Date(a.latestSave)
      )
      setSessions(sorted)
      setLoading(false)
    }
    load()
  }, [])

  function toggleExpand(idx) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 space-y-4">
      <PageHeader
        title="Event Day History"
        subtitle="Review your past event day times"
        icon={<History size={22} className="text-green-700" />}
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500 text-sm">
            No event day history yet. Save times on the Event Day page and they&apos;ll appear here.
          </CardContent>
        </Card>
      ) : (
        sessions.map((session, idx) => {
          const ev = session.event
          const riderList = Array.from(session.riders.values())
          const isOpen = expanded.has(idx)
          return (
            <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleExpand(idx)}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition text-left"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Q{ev?.qualifier_number} — {ev?.venue || 'Unknown venue'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(ev?.date)} · {riderList.length} rider{riderList.length !== 1 ? 's' : ''} tracked
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Saved {formatDate(session.latestSave)}
                  </p>
                </div>
                {isOpen
                  ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                }
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {riderList.map((rider, ri) => (
                    <div key={ri} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        {rider.runNumber && (
                          <span className="text-xs font-bold text-gray-400">#{rider.runNumber}</span>
                        )}
                        <span className="text-sm font-semibold text-gray-800">{rider.riderName || '—'}</span>
                        {rider.horseName && (
                          <span className="text-xs text-gray-500">· {rider.horseName}</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ml-auto ${LEVEL_STYLES[rider.levelEntered] || 'bg-gray-100 text-gray-600'}`}>
                          L{rider.levelEntered}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        {rider.games.map((g, gi) => (
                          <div key={gi} className="flex items-center gap-1.5 text-xs">
                            <span className="text-gray-400">{g.game}:</span>
                            {g.is_nt
                              ? <span className="text-red-600 font-semibold">NT</span>
                              : <span className="font-semibold text-gray-800">{g.time != null ? parseFloat(g.time).toFixed(3) + 's' : '—'}</span>
                            }
                            {g.level_achieved !== null && g.level_achieved !== undefined && !g.is_nt && (
                              <span className={`px-1 rounded text-[10px] font-bold ${LEVEL_STYLES[g.level_achieved] || ''}`}>
                                L{g.level_achieved}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
