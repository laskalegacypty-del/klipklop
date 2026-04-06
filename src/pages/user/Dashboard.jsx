import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, CardContent, EmptyState, PageHeader, Skeleton } from '../../components/ui'
import {
  Calendar,
  Clock,
  AlertTriangle,
  ChevronRight,
  MapPin,
  Megaphone,
  Pin,
  CheckCircle2,
  XCircle,
  UserSearch,
  Trophy,
  Users,
  X,
  Star
} from 'lucide-react'

const CURRENT_YEAR = new Date().getFullYear()

// ─── Mini Calendar Helpers ────────────────────────────────────────────────────

const MINI_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const EVENT_TYPE_COLORS = {
  qualifier:  'bg-green-500',
  regionals:  'bg-blue-500',
  nationals:  'bg-yellow-500',
  'demo day': 'bg-orange-500',
}

function getMonthGrid(year, month) {
  const rawFirstDay = new Date(year, month, 1).getDay()
  const firstDay = (rawFirstDay + 6) % 7
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

// ─── Level helpers ─────────────────────────────────────────────────────────────

function getLevelStyle(level) {
  if (level === 4) return 'bg-red-100 text-red-700'
  if (level === 3) return 'bg-orange-100 text-orange-700'
  if (level === 2) return 'bg-green-100 text-green-700'
  if (level === 1) return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

// ─── Mini Calendar Component ──────────────────────────────────────────────────

// ─── Calendar Section (mini calendar + selected-day detail) ──────────────────

function EventRow({ event }) {
  const typeColor = EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-400'
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
      {/* Colored date badge */}
      <div className="flex-shrink-0 w-10 text-center">
        <div className={`${typeColor} text-white rounded-t-md py-0.5 text-[10px] font-medium`}>
          {new Date(event.date + 'T00:00:00').toLocaleDateString('en-ZA', { month: 'short' })}
        </div>
        <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-md pb-1 pt-0.5">
          <span className="text-base font-bold text-gray-800">
            {new Date(event.date + 'T00:00:00').getDate()}
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {event.qualifier_number && (
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full">
              Q{event.qualifier_number}
            </span>
          )}
          <span className="text-xs capitalize text-gray-500">{event.event_type}</span>
        </div>
        <p className="text-sm font-medium text-gray-800 truncate mt-0.5">{event.venue}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin size={11} className="text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">{event.province}</span>
        </div>
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </div>
  )
}

function CalendarSection({ events }) {
  const [selectedDate, setSelectedDate] = useState(null)

  const selectedDayEvents = selectedDate
    ? events.filter(e => isSameDay(new Date(e.date + 'T00:00:00'), selectedDate))
    : []

  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Upcoming Qualifiers
          </h2>
        </div>
        <Link to="/qualifiers" className="text-sm font-semibold text-green-800 hover:underline flex items-center gap-1">
          View all →
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState title="No upcoming events" description="Check back later for qualifier dates." />
      ) : (
        <>
          <MiniCalendar
            events={events}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          <div className="mt-3 space-y-2">
            {/* Selected day detail */}
            {selectedDate && (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                    {selectedDateLabel} — {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
                  >
                    <X size={11} />
                    Show upcoming
                  </button>
                </div>
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">No events on this date.</p>
                ) : (
                  selectedDayEvents.map(ev => <EventRow key={ev.id} event={ev} />)
                )}
              </>
            )}

            {/* Default: next 3 upcoming when nothing selected */}
            {!selectedDate && (
              <>
                <p className="text-xs text-gray-400 px-1 font-medium uppercase tracking-wide">Next up</p>
                {events.slice(0, 3).map(ev => <EventRow key={ev.id} event={ev} />)}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MiniCalendar({ events, selectedDate, onSelectDate }) {
  const today = new Date()
  const year  = today.getFullYear()
  const month = today.getMonth()
  const grid  = getMonthGrid(year, month)

  const monthLabel = today.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })

  function eventsOnDay(date) {
    return events.filter(e => isSameDay(new Date(e.date + 'T00:00:00'), date))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Calendar header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{monthLabel}</p>
        {selectedDate && (
          <button
            onClick={() => onSelectDate(null)}
            className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
          >
            <X size={11} />
            Clear
          </button>
        )}
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {MINI_DAYS.map((d, i) => (
          <div key={i} className="py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase">
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
            const isCurrentMonth = date.getMonth() === month
            const isToday        = isSameDay(date, today)
            const dayEvents      = eventsOnDay(date)
            const hasEvent       = dayEvents.length > 0
            const isPast         = date < today && !isToday
            const isSelected     = selectedDate && isSameDay(date, selectedDate)

            const cellContent = (
              <>
                <span className={`text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
                  isSelected
                    ? 'bg-green-700 text-white font-bold ring-2 ring-green-300'
                    : isToday
                    ? 'bg-green-600 text-white font-bold'
                    : isCurrentMonth
                    ? isPast ? 'text-gray-300' : 'text-gray-700'
                    : 'text-gray-200'
                }`}>
                  {date.getDate()}
                </span>

                {/* Event dots */}
                {hasEvent && (
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {dayEvents.slice(0, 2).map((ev, idx) => {
                      const dotColor = EVENT_TYPE_COLORS[ev.event_type] || 'bg-gray-400'
                      return (
                        <span
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isPast ? 'opacity-40' : ''}`}
                        />
                      )
                    })}
                    {dayEvents.length > 2 && (
                      <span className="text-[8px] text-gray-400 leading-none">+{dayEvents.length - 2}</span>
                    )}
                  </div>
                )}
              </>
            )

            // Days with events are clickable buttons; others are plain divs
            const baseClass = `min-h-[36px] px-0.5 py-1 flex flex-col items-center gap-0.5 ${
              di < 6 ? 'border-r border-gray-100' : ''
            } ${
              isSelected
                ? 'bg-green-50'
                : isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'
            }`

            return hasEvent ? (
              <button
                key={di}
                onClick={() => onSelectDate(isSelected ? null : date)}
                className={`${baseClass} hover:bg-green-50 active:scale-95 transition cursor-pointer`}
                title={`${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''} on ${date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`}
              >
                {cellContent}
              </button>
            ) : (
              <div key={di} className={baseClass}>
                {cellContent}
              </div>
            )
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/40 flex flex-wrap gap-2.5">
        {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-[10px] text-gray-500 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Announcements Drawer ────────────────────────────────────────────────────

function AnnouncementsDrawer({ announcements, open, onClose }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-full z-50 bg-white shadow-2xl border-l border-gray-200 flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-green-700" />
            <h2 className="font-semibold text-gray-800 text-sm">Announcements</h2>
            {announcements.length > 0 && (
              <span className="text-xs bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">
                {announcements.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {announcements.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Megaphone size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No announcements right now.</p>
            </div>
          ) : (
            announcements.map(ann => (
              <div
                key={ann.id}
                className={`rounded-xl border p-4 ${
                  ann.is_pinned
                    ? 'border-yellow-200 bg-yellow-50/60'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-2">
                  {ann.is_pinned && (
                    <Pin size={13} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{ann.title}</p>
                      {ann.is_pinned && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{ann.body}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(ann.created_at).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

// ─── Eligibility Card ─────────────────────────────────────────────────────────

function EligibilityCard({ combo, province }) {
  const metQualifiers      = combo.qualifiersAttended >= 2
  const metProvince        = combo.provinceQualifiers >= 2
  const metGames           = combo.gamesCovered >= 11
  const criteriaMet        = [metQualifiers, metProvince, metGames].filter(Boolean).length
  const allMet             = criteriaMet === 3

  // Colour theme based on criteria met (0 → red-orange, 1 → orange, 2 → amber, 3 → green)
  const theme = allMet
    ? {
        card:    'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300',
        header:  'text-green-800',
        sub:     'text-green-600',
        icon:    'text-green-500',
        bar:     'bg-green-500',
        barBg:   'bg-green-100',
        row:     'text-green-700',
        rowBg:   'bg-green-100/60',
        link:    'text-green-700 hover:text-green-900',
        badge:   'bg-green-600 text-white',
      }
    : criteriaMet === 2
    ? {
        card:    'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300',
        header:  'text-amber-800',
        sub:     'text-amber-600',
        icon:    'text-amber-500',
        bar:     'bg-amber-400',
        barBg:   'bg-amber-100',
        row:     'text-amber-700',
        rowBg:   'bg-amber-100/60',
        link:    'text-amber-700 hover:text-amber-900',
        badge:   'bg-amber-500 text-white',
      }
    : criteriaMet === 1
    ? {
        card:    'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300',
        header:  'text-orange-800',
        sub:     'text-orange-600',
        icon:    'text-orange-500',
        bar:     'bg-orange-500',
        barBg:   'bg-orange-100',
        row:     'text-orange-700',
        rowBg:   'bg-orange-100/60',
        link:    'text-orange-700 hover:text-orange-900',
        badge:   'bg-orange-500 text-white',
      }
    : {
        card:    'bg-gradient-to-br from-red-50 to-orange-50 border-red-300',
        header:  'text-red-800',
        sub:     'text-red-500',
        icon:    'text-red-400',
        bar:     'bg-red-400',
        barBg:   'bg-red-100',
        row:     'text-red-700',
        rowBg:   'bg-red-100/60',
        link:    'text-red-700 hover:text-red-900',
        badge:   'bg-red-500 text-white',
      }

  const hasAnyProgress =
    combo.qualifiersAttended > 0 ||
    combo.provinceQualifiers > 0 ||
    combo.gamesCovered > 0

  const statusLabel = allMet
    ? 'Nationals Eligible!'
    : criteriaMet === 2
    ? 'Almost There'
    : criteriaMet === 1 || hasAnyProgress
    ? 'In Progress'
    : 'Not Yet Started'

  const statusIcon = allMet
    ? <CheckCircle2 size={20} className={theme.icon} />
    : <AlertTriangle size={20} className={theme.icon} />

  // Individual criterion rows
  const criteria = [
    {
      label:   'Total qualifiers attended',
      value:   combo.qualifiersAttended,
      target:  2,
      met:     metQualifiers,
      pct:     Math.min(100, (combo.qualifiersAttended / 2) * 100),
      detail:  `${combo.qualifiersAttended} of 2 required`,
    },
    {
      label:   `Province qualifiers (${province || 'your province'})`,
      value:   combo.provinceQualifiers,
      target:  2,
      met:     metProvince,
      pct:     Math.min(100, (combo.provinceQualifiers / 2) * 100),
      detail:  `${combo.provinceQualifiers} of 2 required`,
    },
    {
      label:   'Games covered',
      value:   combo.gamesCovered,
      target:  11,
      met:     metGames,
      pct:     Math.min(100, (combo.gamesCovered / 13) * 100),
      detail:  `${combo.gamesCovered} of 13 games (need 11+)`,
    },
  ]

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${theme.card}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          {statusIcon}
          <div>
            <p className={`font-bold text-base ${theme.header}`}>Nationals Eligibility</p>
            <p className={`text-xs font-medium mt-0.5 ${theme.sub}`}>{combo.horse_name}</p>
          </div>
        </div>
        <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${theme.badge}`}>
          {statusLabel}
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[11px] font-semibold uppercase tracking-wide ${theme.sub}`}>
            Overall progress
          </span>
          <span className={`text-[11px] font-bold ${theme.header}`}>{criteriaMet}/3 criteria met</span>
        </div>
        <div className={`h-2 rounded-full ${theme.barBg}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${theme.bar}`}
            style={{ width: `${(criteriaMet / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Criteria rows */}
      <div className="space-y-2 mb-4">
        {criteria.map((c, i) => (
          <div key={i} className={`rounded-xl px-3 py-2.5 ${theme.rowBg}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                {c.met
                  ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                  : <XCircle size={13} className={`${theme.icon} flex-shrink-0`} />
                }
                <span className={`text-xs font-medium ${theme.row}`}>{c.label}</span>
              </div>
              <span className={`text-xs font-bold ${theme.header}`}>{c.detail}</span>
            </div>
            <div className={`h-1.5 rounded-full ${theme.barBg}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${c.met ? 'bg-green-500' : theme.bar}`}
                style={{ width: `${c.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer link */}
      <Link
        to="/season"
        className={`text-xs font-semibold flex items-center gap-1 ${theme.link}`}
      >
        View full season overview →
      </Link>
    </div>
  )
}

// ─── Horse Card ───────────────────────────────────────────────────────────────

function HorseCard({ combo, riderName }) {
  const nationalsEligible =
    combo.qualifiersAttended >= 2 &&
    combo.provinceQualifiers >= 2 &&
    combo.gamesCovered >= 11

  const gamesPercent = Math.min(100, Math.round((combo.gamesCovered / 13) * 100))

  return (
    <div
      className={`relative rounded-2xl border p-4 flex flex-col gap-3 transition shadow-sm hover:shadow-md ${
        combo.is_pinned
          ? 'border-green-300 bg-gradient-to-br from-green-50/60 to-white'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Pinned star */}
      {combo.is_pinned && (
        <span
          className="absolute top-3 right-3 text-yellow-400"
          title="Primary horse"
        >
          <Star size={14} fill="currentColor" />
        </span>
      )}

      {/* Horse photo + name */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden border border-gray-200 shadow-sm">
          {combo.horse_photo_url ? (
            <img
              src={combo.horse_photo_url}
              alt={combo.horse_name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-xl font-bold ${
              combo.is_pinned ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {combo.horse_name?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base truncate">{combo.horse_name}</p>
          <p className="text-xs text-gray-400 truncate">{riderName}</p>
          {/* Level badge */}
          <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${getLevelStyle(combo.current_level)}`}>
            Level {combo.current_level ?? 0}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        {/* Qualifiers attended */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Qualifiers attended</span>
            <span className="text-xs font-bold text-gray-700">{combo.qualifiersAttended}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                combo.qualifiersAttended >= 2 ? 'bg-green-500' : 'bg-orange-400'
              }`}
              style={{ width: `${Math.min(100, (combo.qualifiersAttended / 4) * 100)}%` }}
            />
          </div>
        </div>

        {/* Games covered */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Games covered</span>
            <span className="text-xs font-bold text-gray-700">{combo.gamesCovered}<span className="font-normal text-gray-400">/13</span></span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                combo.gamesCovered >= 11 ? 'bg-green-500' : combo.gamesCovered >= 7 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${gamesPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Eligibility chip */}
      <div className="pt-1 border-t border-gray-100">
        {nationalsEligible ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
            <CheckCircle2 size={12} />
            Nationals Eligible
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 bg-red-50 px-3 py-1 rounded-full border border-red-200">
            <XCircle size={12} />
            Not Yet Qualified
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { profile, isSupporter, isClubHead, isClubMember } = useAuth()
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [comboStats, setComboStats] = useState([])
  const [announcementsOpen, setAnnouncementsOpen] = useState(false)
  // Supporter / club_head specific state
  const [linkedRiderSummaries, setLinkedRiderSummaries] = useState([])
  /** Latest pending club/family invite (riders only); accept/decline lives on Profile */
  const [pendingClubInvite, setPendingClubInvite] = useState(null)

  useEffect(() => {
    if (profile) fetchDashboardData()
  }, [profile, isSupporter, isClubHead])

  async function fetchPendingClubInvite() {
    if (!profile?.id) {
      setPendingClubInvite(null)
      return
    }
    const { data: row, error } = await supabase
      .from('club_member_links')
      .select('id, club_head_id')
      .eq('rider_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !row) {
      setPendingClubInvite(null)
      return
    }

    const { data: head } = await supabase
      .from('profiles')
      .select('rider_name, profile_photo_url')
      .eq('id', row.club_head_id)
      .maybeSingle()

    if (!head) {
      setPendingClubInvite(null)
      return
    }

    setPendingClubInvite({
      headName: head.rider_name,
      headPhoto: head.profile_photo_url
    })
  }

  async function fetchDashboardData() {
    try {
      if (isSupporter) {
        setPendingClubInvite(null)
        await Promise.all([
          fetchAnnouncements(),
          fetchUpcomingEvents(),
          fetchLinkedRiderSummaries()
        ])
      } else if (isClubHead) {
        setPendingClubInvite(null)
        await Promise.all([
          fetchAnnouncements(),
          fetchUpcomingEvents(),
          fetchClubMemberSummaries()
        ])
      } else {
        // 'user' and 'club_member' — show own combo stats
        await Promise.all([
          fetchAnnouncements(),
          fetchUpcomingEvents(),
          fetchAllCombosStats(),
          fetchPendingClubInvite()
        ])
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)

    setAnnouncements(data || [])
  }

  async function fetchUpcomingEvents() {
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('qualifier_events')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(20)

    setUpcomingEvents(data || [])
  }

  async function fetchAllCombosStats() {
    const yearStart = `${CURRENT_YEAR}-01-01`
    const yearEnd = `${CURRENT_YEAR}-12-31`

    const [{ data: combos }, { data: horses }, { data: currentYearEvents }] = await Promise.all([
      supabase
        .from('horse_rider_combos')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_archived', false)
        .order('is_pinned', { ascending: false }),
      supabase
        .from('horses')
        .select('id, name, photo_url')
        .eq('user_id', profile.id),
      supabase
        .from('qualifier_events')
        .select('id, province')
        .gte('date', yearStart)
        .lte('date', yearEnd)
    ])

    if (!combos || combos.length === 0) {
      setComboStats([])
      return
    }

    const horseMap = {}
    horses?.forEach(h => { horseMap[h.id] = h })

    const currentYearEventIds = currentYearEvents?.map(e => e.id) || []
    const eventProvinceMap = {}
    currentYearEvents?.forEach(e => { eventProvinceMap[e.id] = e.province })

    const statsPromises = combos.map(async (combo) => {
      const [resultsRes, pbsRes] = await Promise.all([
        currentYearEventIds.length > 0
          ? supabase
              .from('qualifier_results')
              .select('event_id')
              .eq('combo_id', combo.id)
              .in('event_id', currentYearEventIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('personal_bests')
          .select('game, best_time')
          .eq('combo_id', combo.id)
          .eq('season_year', CURRENT_YEAR)
      ])

      const results = resultsRes.data || []
      const pbs = pbsRes.data || []

      const uniqueEventIds = [...new Set(results.map(r => r.event_id))]

      const provinceQualifiers = new Set(
        uniqueEventIds.filter(eventId => eventProvinceMap[eventId] === profile.province)
      ).size

      const linkedHorse = combo.horse_id
        ? horseMap[combo.horse_id]
        : horses?.find(h => h.name.toLowerCase() === combo.horse_name?.toLowerCase())

      return {
        ...combo,
        qualifiersAttended: uniqueEventIds.length,
        gamesCovered: pbs.length,
        provinceQualifiers,
        horse_photo_url: linkedHorse?.photo_url || null
      }
    })

    const stats = await Promise.all(statsPromises)
    setComboStats(stats)
  }

  async function fetchLinkedRiderSummaries() {
    const { data: links } = await supabase
      .from('supporter_rider_links')
      .select('rider_id')
      .eq('supporter_id', profile.id)
      .eq('status', 'accepted')

    if (!links || links.length === 0) {
      setLinkedRiderSummaries([])
      return
    }

    const riderIds = links.map(l => l.rider_id)

    const { data: riders } = await supabase
      .from('profiles')
      .select('id, rider_name, province, profile_photo_url')
      .in('id', riderIds)

    if (!riders) {
      setLinkedRiderSummaries([])
      return
    }

    const yearStart = `${CURRENT_YEAR}-01-01`
    const yearEnd = `${CURRENT_YEAR}-12-31`

    const { data: currentYearEvents } = await supabase
      .from('qualifier_events')
      .select('id')
      .gte('date', yearStart)
      .lte('date', yearEnd)

    const currentYearEventIds = currentYearEvents?.map(e => e.id) || []

    const summaries = await Promise.all(riders.map(async (rider) => {
      const { data: combos } = await supabase
        .from('horse_rider_combos')
        .select('id, horse_name, current_level, is_pinned')
        .eq('user_id', rider.id)
        .eq('is_archived', false)

      if (!combos || combos.length === 0) {
        return { ...rider, horsesCount: 0, qualifiersAttended: 0, nationalsLevel: null }
      }

      const comboIds = combos.map(c => c.id)
      const pinnedCombo = combos.find(c => c.is_pinned) || combos[0]

      let qualifiersAttended = 0
      if (currentYearEventIds.length > 0) {
        const { data: results } = await supabase
          .from('qualifier_results')
          .select('event_id')
          .in('combo_id', comboIds)
          .in('event_id', currentYearEventIds)
        qualifiersAttended = new Set(results?.map(r => r.event_id) || []).size
      }

      const { data: pbs } = await supabase
        .from('personal_bests')
        .select('best_time')
        .eq('combo_id', pinnedCombo.id)
        .eq('season_year', CURRENT_YEAR)

      const nationalsLevel = pbs ? pbs.length : 0

      return {
        ...rider,
        horsesCount: combos.length,
        qualifiersAttended,
        gamesCovered: nationalsLevel,
        currentLevel: pinnedCombo.current_level ?? 0
      }
    }))

    setLinkedRiderSummaries(summaries)
  }

  async function fetchClubMemberSummaries() {
    const { data: links } = await supabase
      .from('club_member_links')
      .select('rider_id')
      .eq('club_head_id', profile.id)
      .eq('status', 'accepted')

    if (!links || links.length === 0) {
      setLinkedRiderSummaries([])
      return
    }

    const riderIds = links.map(l => l.rider_id)

    const { data: riders } = await supabase
      .from('profiles')
      .select('id, rider_name, province, profile_photo_url, age_category')
      .in('id', riderIds)

    if (!riders) { setLinkedRiderSummaries([]); return }

    const yearStart = `${CURRENT_YEAR}-01-01`
    const yearEnd = `${CURRENT_YEAR}-12-31`

    const { data: currentYearEvents } = await supabase
      .from('qualifier_events')
      .select('id')
      .gte('date', yearStart)
      .lte('date', yearEnd)

    const currentYearEventIds = currentYearEvents?.map(e => e.id) || []

    const summaries = await Promise.all(riders.map(async (rider) => {
      const { data: combos } = await supabase
        .from('horse_rider_combos')
        .select('id, horse_name, horse_id, current_level, is_pinned')
        .eq('user_id', rider.id)
        .eq('is_archived', false)

      if (!combos || combos.length === 0) {
        return { ...rider, horsesCount: 0, qualifiersAttended: 0, gamesCovered: 0, nationalsLevel: null, currentLevel: 0 }
      }

      const comboIds = combos.map(c => c.id)
      const pinnedCombo = combos.find(c => c.is_pinned) || combos[0]

      let qualifiersAttended = 0
      if (currentYearEventIds.length > 0) {
        const { data: results } = await supabase
          .from('qualifier_results')
          .select('event_id')
          .in('combo_id', comboIds)
          .in('event_id', currentYearEventIds)
        qualifiersAttended = new Set(results?.map(r => r.event_id) || []).size
      }

      const { data: pbs } = await supabase
        .from('personal_bests')
        .select('best_time')
        .eq('combo_id', pinnedCombo.id)
        .eq('season_year', CURRENT_YEAR)

      return {
        ...rider,
        horsesCount: combos.length,
        qualifiersAttended,
        gamesCovered: pbs?.length || 0,
        currentLevel: pinnedCombo.current_level ?? 0
      }
    }))

    setLinkedRiderSummaries(summaries)
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40" />
      <Skeleton className="h-24" />
      <Skeleton className="h-40" />
    </div>
  )

  const showRiderStats = !isSupporter && !isClubHead
  const primaryCombo = showRiderStats ? (comboStats.find(c => c.is_pinned) || comboStats[0]) : null
  const isEligibilityAtRisk = primaryCombo && (
    primaryCombo.qualifiersAttended < 2 ||
    primaryCombo.gamesCovered < 11 ||
    primaryCombo.provinceQualifiers < 2
  )

  function getRoleLabel() {
    if (isSupporter) return 'Supporter'
    if (isClubHead) return 'Club Head'
    if (isClubMember) return 'Rider'
    return 'Rider'
  }

  return (
    <div className="space-y-6">

      {/* Welcome header + Announcements toggle button */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={`Welcome back, ${profile?.rider_name?.split(' ')[0] || getRoleLabel()}!`}
          description={new Date().toLocaleDateString('en-ZA', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        />

        {/* Announcements toggle */}
        <button
          onClick={() => setAnnouncementsOpen(o => !o)}
          className="relative flex-shrink-0 flex items-center gap-2 bg-white border border-gray-200 hover:border-green-300 hover:bg-green-50 text-gray-600 hover:text-green-700 px-3 py-2 rounded-xl shadow-sm transition mt-1"
          title="Toggle Announcements"
        >
          <Megaphone size={17} />
          <span className="text-sm font-medium hidden sm:inline">Announcements</span>
          {announcements.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
              {announcements.length}
            </span>
          )}
        </button>
      </div>

      {/* Announcements drawer */}
      <AnnouncementsDrawer
        announcements={announcements}
        open={announcementsOpen}
        onClose={() => setAnnouncementsOpen(false)}
      />

      {showRiderStats && pendingClubInvite && (
        <Card className="border-yellow-200 bg-yellow-50/80 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-yellow-200 bg-yellow-100 flex items-center justify-center flex-shrink-0">
                {pendingClubInvite.headPhoto ? (
                  <img
                    src={pendingClubInvite.headPhoto}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-sm font-bold text-yellow-800">
                    {pendingClubInvite.headName?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">Club / family invitation</p>
                <p className="text-sm text-gray-600 truncate">
                  <span className="font-medium text-gray-800">{pendingClubInvite.headName}</span>
                  {' '}wants to add you to their club or family. Accept or decline under Profile → My Club / Family.
                </p>
              </div>
            </div>
            <Link
              to="/profile#my-club-family"
              className="inline-flex items-center justify-center gap-1 flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition"
            >
              Open Profile
              <ChevronRight size={16} />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* === SUPPORTER VIEW === */}
      {isSupporter && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                My Riders — {CURRENT_YEAR}
              </h2>
            </div>
            <Link
              to="/my-riders"
              className="text-sm font-semibold text-green-800 hover:underline flex items-center gap-1"
            >
              <UserSearch size={13} />
              Manage Riders →
            </Link>
          </div>

          {linkedRiderSummaries.length === 0 ? (
            <EmptyState
              title="No linked riders yet"
              description="Go to My Riders to search for and request to follow a rider."
              action={
                <Link to="/my-riders" className="text-sm font-semibold text-green-800 hover:underline">
                  Go to My Riders →
                </Link>
              }
            />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rider</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Horses</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qualifiers</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Games Covered</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {linkedRiderSummaries.map(rider => (
                      <tr key={rider.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden border border-gray-200 bg-green-100 flex items-center justify-center">
                              {rider.profile_photo_url ? (
                                <img src={rider.profile_photo_url} alt={rider.rider_name} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <span className="text-xs font-bold text-green-700">{rider.rider_name?.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-800 text-sm">{rider.rider_name}</div>
                              <div className="text-xs text-gray-400">{rider.province || 'No province'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">{rider.horsesCount}</td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">{rider.qualifiersAttended}</td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">
                          {rider.gamesCovered}<span className="text-gray-400 font-normal">/13</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getLevelStyle(rider.currentLevel)}`}>
                            L{rider.currentLevel ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* === CLUB HEAD VIEW === */}
      {isClubHead && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                My Club Riders — {CURRENT_YEAR}
              </h2>
            </div>
            <Link
              to="/my-club-riders"
              className="text-sm font-semibold text-green-800 hover:underline flex items-center gap-1"
            >
              <UserSearch size={13} />
              Manage Riders →
            </Link>
          </div>

          {linkedRiderSummaries.length === 0 ? (
            <EmptyState
              title="No riders yet"
              description="Go to My Riders to add riders to your club."
              action={
                <Link to="/my-club-riders" className="text-sm font-semibold text-green-800 hover:underline">
                  Go to My Riders →
                </Link>
              }
            />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rider</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Horses</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qualifiers</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Games</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {linkedRiderSummaries.map(rider => (
                      <tr key={rider.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden border border-gray-200 bg-green-100 flex items-center justify-center">
                              {rider.profile_photo_url ? (
                                <img src={rider.profile_photo_url} alt={rider.rider_name} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <span className="text-xs font-bold text-green-700">{rider.rider_name?.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-800 text-sm">{rider.rider_name}</div>
                              <div className="text-xs text-gray-400">{rider.age_category || rider.province || 'No details'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">{rider.horsesCount}</td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">{rider.qualifiersAttended}</td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">
                          {rider.gamesCovered}<span className="text-gray-400 font-normal">/13</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getLevelStyle(rider.currentLevel)}`}>
                            L{rider.currentLevel ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* === RIDER VIEW === */}
      {showRiderStats && (
        <>
          {/* Eligibility card */}
          {primaryCombo && (
            <EligibilityCard combo={primaryCombo} province={profile?.province} />
          )}

          {/* No combo yet */}
          {comboStats.length === 0 && (
            <EmptyState
              title="Get started"
              description="Add your first horse/rider combo to start tracking your times."
              action={
                <Link to="/profile" className="text-sm font-semibold text-green-800 hover:underline">
                  Go to profile →
                </Link>
              }
            />
          )}

          {/* ── My Horses — card grid ── */}
          {comboStats.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    My Horses — {CURRENT_YEAR}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{comboStats.length} horse{comboStats.length !== 1 ? 's' : ''} registered</p>
                </div>
                <Link
                  to="/my-times"
                  className="text-sm font-semibold text-green-800 hover:underline flex items-center gap-1"
                >
                  <Clock size={13} />
                  View My Times →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {comboStats.map(combo => (
                  <HorseCard
                    key={combo.id}
                    combo={combo}
                    riderName={profile?.rider_name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Upcoming Qualifiers — Mini Calendar ── */}
          <CalendarSection events={upcomingEvents} />
        </>
      )}

      {/* Upcoming events for non-rider roles */}
      {!showRiderStats && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Upcoming Qualifiers
              </h2>
            </div>
            <Link to="/qualifiers" className="text-sm font-semibold text-green-800 hover:underline">
              View all →
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <EmptyState title="No upcoming events" description="Check back later for qualifier dates." />
          ) : (
            <div className="space-y-3">
              {upcomingEvents.slice(0, 3).map(event => (
                <Card key={event.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="brand" className="capitalize">{event.event_type}</Badge>
                        {event.qualifier_number && (
                          <Badge>Q{event.qualifier_number}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Calendar size={14} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">
                          {new Date(event.date + 'T00:00:00').toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {event.venue}, {event.province}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-300" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
