import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { QUALIFIER_GAMES, PROVINCES } from '../../lib/constants'
import { Card, CardContent, PageHeader, Skeleton } from '../../components/ui'
import {
  Calendar,
  MapPin,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  List,
  X,
  Trophy,
  Tag,
  StickyNote,
  CalendarDays,
  Search
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonthGrid(year, month) {
  // Returns a 6-row × 7-col grid of Date objects (some from prev/next month)
  // Week starts on Monday (0 = Mon … 6 = Sun)
  const rawFirstDay = new Date(year, month, 1).getDay() // 0=Sun,1=Mon…6=Sat
  const firstDay = (rawFirstDay + 6) % 7               // shift so 0=Mon
  const grid = []
  let day = 1 - firstDay
  for (let row = 0; row < 6; row++) {
    const week = []
    for (let col = 0; col < 7; col++, day++) {
      week.push(new Date(year, month, day))
    }
    grid.push(week)
  }
  return grid
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getEventStatus(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const eventDate = new Date(date)
  const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: 'Past', style: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' }
  if (diffDays === 0) return { label: 'Today!', style: 'bg-green-100 text-green-700', dot: 'bg-green-500' }
  if (diffDays <= 7) return { label: 'This week', style: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' }
  return { label: 'Upcoming', style: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' }
}

const EVENT_TYPE_COLORS = {
  qualifier:  'bg-green-600',
  regionals:  'bg-blue-600',
  nationals:  'bg-yellow-500',
  'demo day': 'bg-orange-500',
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function QualifierDetailModal({ event, bookmarks, onToggleBookmark, onClose }) {
  if (!event) return null
  const isBookmarked = bookmarks.includes(event.id)
  const games = event.qualifier_number ? QUALIFIER_GAMES[event.qualifier_number] : null
  const status = getEventStatus(event.date)
  const typeColor = EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-600'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className={`${typeColor} rounded-t-2xl sm:rounded-t-2xl px-5 py-4 text-white`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full capitalize">
                  {event.event_type}
                </span>
                {event.qualifier_number && (
                  <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                    Qualifier #{event.qualifier_number}
                  </span>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.style}`}>
                  {status.label}
                </span>
              </div>
              <h2 className="mt-2 text-lg font-bold leading-snug">
                {event.venue}
              </h2>
              <p className="text-sm text-white/80">{event.province}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">

          {/* Date */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <CalendarDays size={18} className="text-green-700" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Date</p>
              <p className="text-sm font-semibold text-gray-800">
                {new Date(event.date).toLocaleDateString('en-ZA', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Venue */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <MapPin size={18} className="text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Venue</p>
              <p className="text-sm font-semibold text-gray-800">{event.venue}</p>
              <p className="text-sm text-gray-500">{event.province}</p>
            </div>
          </div>

          {/* Event type */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Tag size={18} className="text-purple-700" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Event Type</p>
              <p className="text-sm font-semibold text-gray-800 capitalize">{event.event_type}</p>
            </div>
          </div>

          {/* Games */}
          {games && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <Trophy size={18} className="text-yellow-700" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
                  Games (Qualifier #{event.qualifier_number})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {games.map(game => (
                    <span
                      key={game}
                      className="text-xs bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-full font-medium"
                    >
                      {game}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <StickyNote size={18} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Notes</p>
                <p className="text-sm text-gray-700 leading-relaxed">{event.notes}</p>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Bookmark action */}
          <button
            onClick={() => onToggleBookmark(event.id)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition ${
              isBookmarked
                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            {isBookmarked ? 'Remove Bookmark' : 'Bookmark this Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Event Card (shared across all views) ────────────────────────────────────

function EventCard({ event, bookmarks, onSelect, onToggleBookmark }) {
  const status = getEventStatus(event.date)
  const isBookmarked = bookmarks.includes(event.id)
  const games = event.qualifier_number ? QUALIFIER_GAMES[event.qualifier_number] : null
  const typeColor = EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-500'

  return (
    <div
      onClick={() => onSelect(event)}
      className={`w-full text-left bg-white rounded-xl border p-4 flex gap-4 hover:shadow-md active:scale-[0.99] transition cursor-pointer ${
        isBookmarked ? 'border-green-300' : 'border-gray-200'
      }`}
    >
      {/* Date block */}
      <div className="flex-shrink-0 w-12 text-center">
        <div className={`${typeColor} text-white rounded-t-lg py-0.5 text-[11px] font-medium`}>
          {new Date(event.date).toLocaleDateString('en-ZA', { month: 'short' })}
        </div>
        <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg py-1.5">
          <span className="text-xl font-bold text-gray-800">
            {new Date(event.date).getDate()}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.style}`}>
            {status.label}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 capitalize">
            {event.event_type}
          </span>
          {event.qualifier_number && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
              Q{event.qualifier_number}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{event.venue}</p>
        <p className="text-xs text-gray-500">{event.province}</p>
        {games && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {games.slice(0, 3).map(game => (
              <span key={game} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                {game}
              </span>
            ))}
            {games.length > 3 && (
              <span className="text-xs text-gray-400 px-2 py-0.5">+{games.length - 3} more</span>
            )}
          </div>
        )}
        {event.notes && (
          <p className="mt-1 text-xs text-gray-400 italic truncate">{event.notes}</p>
        )}
      </div>

      {/* Right actions: bookmark + chevron */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5">
        <button
          onClick={e => { e.stopPropagation(); onToggleBookmark(event.id) }}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark this event'}
          className={`p-1.5 rounded-lg transition ${
            isBookmarked
              ? 'text-green-600 bg-green-50 hover:bg-red-50 hover:text-red-500'
              : 'text-gray-300 hover:text-green-600 hover:bg-green-50'
          }`}
        >
          {isBookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
        </button>
        <ChevronRight size={16} className="text-gray-300" />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Qualifiers() {
  const { profile } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookmarks, setBookmarks] = useState([])
  const [viewMode, setViewMode] = useState('calendar')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Calendar navigation state — start at current month
  const today = new Date()
  const [calendarYear, setCalendarYear]   = useState(today.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth())

  useEffect(() => {
    fetchEvents()
    fetchBookmarks()
  }, [])

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from('qualifier_events')
        .select('*')
        .order('date', { ascending: true })
      if (error) throw error
      setEvents(data || [])
    } catch {
      toast.error('Error loading events')
    } finally {
      setLoading(false)
    }
  }

  async function fetchBookmarks() {
    try {
      const { data } = await supabase
        .from('bookmarked_events')
        .select('event_id')
        .eq('user_id', profile.id)
      setBookmarks(data?.map(b => b.event_id) || [])
    } catch (error) {
      console.error('Error fetching bookmarks:', error)
    }
  }

  async function toggleBookmark(eventId) {
    const isBookmarked = bookmarks.includes(eventId)
    try {
      if (isBookmarked) {
        await supabase
          .from('bookmarked_events')
          .delete()
          .eq('user_id', profile.id)
          .eq('event_id', eventId)
        setBookmarks(prev => prev.filter(id => id !== eventId))
        toast.success('Bookmark removed')
      } else {
        await supabase
          .from('bookmarked_events')
          .insert({ user_id: profile.id, event_id: eventId })
        setBookmarks(prev => [...prev, eventId])
        toast.success('Event bookmarked!')
      }
    } catch {
      toast.error('Error updating bookmark')
    }
  }

  // ── Month navigation ──
  function prevMonth() {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1) }
    else setCalendarMonth(m => m - 1)
  }
  function nextMonth() {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1) }
    else setCalendarMonth(m => m + 1)
  }

  // ── Events for calendar month ──
  const grid = getMonthGrid(calendarYear, calendarMonth)

  function eventsOnDay(date) {
    return events.filter(e => isSameDay(new Date(e.date), date))
  }

  // ── List view: all events sorted ──
  function groupByMonth(evts) {
    const groups = {}
    evts.forEach(event => {
      const key = new Date(event.date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    })
    return groups
  }

  // ── Wildcard search filter ──
  function matchesSearch(event) {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    const haystack = [
      event.qualifier_number != null ? `q${event.qualifier_number}` : '',
      event.qualifier_number != null ? `qualifier ${event.qualifier_number}` : '',
      event.venue ?? '',
      event.province ?? '',
      event.event_type ?? '',
      event.notes ?? ''
    ].join(' ').toLowerCase()
    return haystack.includes(q)
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-72" />
    </div>
  )

  const monthLabel = new Date(calendarYear, calendarMonth).toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric'
  })

  const filteredEvents = events.filter(matchesSearch)
  const groupedEvents = groupByMonth(filteredEvents)

  return (
    <div className="space-y-5">

      {/* Page header */}
      <PageHeader
        title="Qualifiers"
        description={`${events.length} event${events.length !== 1 ? 's' : ''} scheduled`}
        actions={
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                viewMode === 'calendar'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar size={15} />
              Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                viewMode === 'list'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={15} />
              List
            </button>
            <button
              onClick={() => setViewMode('bookmarked')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                viewMode === 'bookmarked'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bookmark size={15} />
              Saved
              {bookmarks.length > 0 && (
                <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  viewMode === 'bookmarked'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {bookmarks.length}
                </span>
              )}
            </button>
          </div>
        }
      />

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by Q1, venue, town, province, event type…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── CALENDAR VIEW ─────────────────────────────────────────── */}
      {viewMode === 'calendar' && (
        <div className="space-y-4">

          {/* ── SEARCH RESULTS (all events, above calendar) ── */}
          {searchQuery.trim() && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 flex items-center gap-2">
                <Search size={14} />
                {filteredEvents.length} result{filteredEvents.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
              </h3>

              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
                  No events match <strong>"{searchQuery}"</strong>. Try a different keyword.
                </div>
              ) : (
                filteredEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    bookmarks={bookmarks}
                    onSelect={setSelectedEvent}
                    onToggleBookmark={toggleBookmark}
                  />
                ))
              )}

              {/* Divider before calendar */}
              <div className="border-t border-gray-200 pt-2">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide px-1">Calendar</p>
              </div>
            </div>
          )}

          {/* Month navigation */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-base font-bold text-gray-800">{monthLabel}</h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {grid.map((week, wi) => (
              <div
                key={wi}
                className={`grid grid-cols-7 ${wi < grid.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                {week.map((date, di) => {
                  const isCurrentMonth = date.getMonth() === calendarMonth
                  const isToday = isSameDay(date, today)
                  const dayEvents = eventsOnDay(date)

                  return (
                    <div
                      key={di}
                      className={`min-h-[72px] sm:min-h-[90px] p-1.5 sm:p-2 ${
                        di < 6 ? 'border-r border-gray-100' : ''
                      } ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/60'}`}
                    >
                      {/* Date number */}
                      <div className="flex justify-center mb-1">
                        <span className={`text-xs sm:text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-green-600 text-white font-bold'
                            : isCurrentMonth
                            ? 'text-gray-700'
                            : 'text-gray-300'
                        }`}>
                          {date.getDate()}
                        </span>
                      </div>

                      {/* Events on this day */}
                      <div className="space-y-0.5">
                        {dayEvents.map(event => {
                          const typeColor = EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-500'
                          const isBookmarked = bookmarks.includes(event.id)
                          return (
                            <button
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={`w-full text-left rounded-md px-1.5 py-0.5 text-white text-[10px] sm:text-xs font-medium truncate transition hover:opacity-80 active:scale-95 ${typeColor} ${
                                isBookmarked ? 'ring-2 ring-offset-1 ring-green-400' : ''
                              }`}
                              title={`${event.venue}${event.qualifier_number ? ` — Q${event.qualifier_number}` : ''}`}
                            >
                              {/* Mobile: just a dot; sm+: short label */}
                              <span className="hidden sm:inline">
                                {event.qualifier_number ? `Q${event.qualifier_number}` : ''} {event.venue}
                              </span>
                              <span className="sm:hidden">
                                {event.qualifier_number ? `Q${event.qualifier_number}` : event.event_type.slice(0,1).toUpperCase()}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 px-1">
            {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
                <span className="text-xs text-gray-500 capitalize">{type}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="w-2.5 h-2.5 rounded-full bg-green-600" />
              <span className="text-xs text-gray-500">Today</span>
            </div>
          </div>

          {/* Events this month — only shown when NOT searching */}
          {!searchQuery.trim() && (() => {
            const monthEvents = events.filter(e => {
              const d = new Date(e.date)
              return d.getFullYear() === calendarYear && d.getMonth() === calendarMonth
            })
            if (monthEvents.length === 0) return (
              <div className="text-center py-8 text-gray-400 text-sm">
                No events scheduled for {monthLabel}
              </div>
            )
            return (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
                  {monthLabel} — {monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}
                </h3>
                {monthEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    bookmarks={bookmarks}
                    onSelect={setSelectedEvent}
                    onToggleBookmark={toggleBookmark}
                  />
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── LIST VIEW ─────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="space-y-8">
          {Object.keys(groupedEvents).length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
              {searchQuery.trim()
                ? <>No events match <strong>"{searchQuery}"</strong>. Try a different keyword.</>
                : 'No events found'
              }
            </div>
          )}
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-2 border-b border-gray-200">
                {month}
              </h2>
              <div className="space-y-2">
                {monthEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    bookmarks={bookmarks}
                    onSelect={setSelectedEvent}
                    onToggleBookmark={toggleBookmark}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BOOKMARKED VIEW ───────────────────────────────────────── */}
      {viewMode === 'bookmarked' && (() => {
        const bookmarkedEvents = events
          .filter(e => bookmarks.includes(e.id))
          .filter(matchesSearch)

        if (bookmarks.length === 0) return (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
              <Bookmark size={26} className="text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700">No saved qualifiers yet</p>
            <p className="text-sm text-gray-400">
              Tap the <BookmarkCheck size={13} className="inline text-green-600" /> icon on any event to save it here for quick access.
            </p>
          </div>
        )

        if (bookmarkedEvents.length === 0) return (
          <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
            No saved events match <strong>"{searchQuery}"</strong>.
          </div>
        )

        const grouped = {}
        bookmarkedEvents.forEach(e => {
          const key = new Date(e.date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(e)
        })

        return (
          <div className="space-y-8">
            <div className="flex items-center gap-2 px-1">
              <BookmarkCheck size={16} className="text-green-600" />
              <span className="text-sm font-semibold text-gray-600">
                {bookmarkedEvents.length} saved qualifier{bookmarkedEvents.length !== 1 ? 's' : ''}
              </span>
            </div>
            {Object.entries(grouped).map(([month, evts]) => (
              <div key={month}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-2 border-b border-gray-200">
                  {month}
                </h2>
                <div className="space-y-2">
                  {evts.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      bookmarks={bookmarks}
                      onSelect={setSelectedEvent}
                      onToggleBookmark={toggleBookmark}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── DETAIL MODAL ──────────────────────────────────────────── */}
      {selectedEvent && (
        <QualifierDetailModal
          event={selectedEvent}
          bookmarks={bookmarks}
          onToggleBookmark={toggleBookmark}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
