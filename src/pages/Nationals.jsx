import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import html2canvas from 'html2canvas'
import Cropper from 'react-easy-crop'
import {
  Trophy, MapPin, CalendarDays, Search, CheckCircle2, RotateCcw, Sparkles,
  Users, UserPlus, ChevronDown, ListChecks, PlayCircle, ChevronLeft, ChevronRight, Target,
  Menu, X, Download, IdCard, Camera,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { APP_LOGO_SRC } from '../constants/branding'
import { getLevel, MATRIX } from '../lib/matrix'
import { GAMES } from '../lib/constants'
import { createCroppedImageFile } from '../lib/imageCrop'
import {
  fetchNationalsEntries,
  findEntriesForName,
  groupByHorse,
  loadVisitor,
  saveVisitor,
  clearVisitor,
  scheduledStartMinutes,
} from '../lib/nationalsEntries'

const LEVEL_LABELS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite']
const LEVEL_COLORS = [
  'text-gray-300 border-gray-400/40 bg-gray-400/10',
  'text-yellow-300 border-yellow-400/40 bg-yellow-400/10',
  'text-blue-300 border-blue-400/40 bg-blue-400/10',
  'text-orange-300 border-orange-400/40 bg-orange-400/10',
  'text-green-300 border-green-400/40 bg-green-400/10',
]

function formatDay(dateStr) {
  if (!dateStr) return 'Date to be confirmed'
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-ZA', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  } catch {
    return dateStr
  }
}

// Compact form for table cells, where "Monday, 28 September" eats too much
// column width — "Mon, 28 Sep" instead.
function formatDayShort(dateStr) {
  if (!dateStr) return 'TBC'
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-ZA', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  } catch {
    return dateStr
  }
}

// ── shared entry sorting/grouping (own schedule, a friend's schedule, the
// times table all need the same chronological ordering) ──────────────────
function sortEntries(list) {
  return [...list].sort((a, b) => {
    const dayCmp = (a.day || '').localeCompare(b.day || '')
    if (dayCmp) return dayCmp
    const timeCmp = scheduledStartMinutes(a.scheduled_time) - scheduledStartMinutes(b.scheduled_time)
    if (timeCmp) return timeCmp
    return (a.run_number ?? 0) - (b.run_number ?? 0)
  })
}

function entriesForIds(entries, ids) {
  const idSet = new Set(ids || [])
  return sortEntries(entries.filter(e => idSet.has(e.id)))
}

// A run only counts once both attempts are in — best (lowest) of the two
// decides the level, per SAWMGA's "2 runs, best time counts" rule.
function computeBestLevel(game, run1, run2) {
  const t1 = parseFloat(run1)
  const t2 = parseFloat(run2)
  const valid = [t1, t2].filter(n => Number.isFinite(n) && n > 0)
  if (!valid.length) return { best: null, level: null }
  const best = Math.min(...valid)
  return { best, level: getLevel(game, best) }
}

function newFriendId() {
  return typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `friend_${Date.now()}`
}

function PageHeader({ event }) {
  const dateLabel = event
    ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-ZA', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <header className="flex flex-col items-center text-center px-4 pt-10 pb-6 sm:pt-14 sm:pb-8">
      <div className="flex items-center gap-2.5 mb-4">
        <img src={APP_LOGO_SRC} alt="KlipKlop" className="h-9 w-9 object-contain" />
        <span className="text-green-400 text-xs font-bold uppercase tracking-widest">KlipKlop</span>
      </div>
      <div className="flex items-center gap-2.5 mb-2">
        <Trophy className="text-yellow-400" size={28} />
        <h1 className="text-white font-black tracking-tight text-3xl sm:text-4xl">Nationals</h1>
      </div>
      <p className="text-green-300/80 text-sm sm:text-base max-w-md">
        Find your entries, see your personal program, and log your times as you ride.
      </p>
      {event && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 text-green-200 text-xs sm:text-sm">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-green-400" />
            {dateLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={14} className="text-green-400" />
            {event.venue}{event.province ? `, ${event.province}` : ''}
          </span>
        </div>
      )}
    </header>
  )
}

function VerifyStep({ firstName, setFirstName, lastName, setLastName, onSubmit, error, submitting }) {
  return (
    <div className="w-full max-w-sm mx-auto px-4 pb-14">
      <div className="bg-white/10 border border-white/20 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-1">Find your entries</h2>
        <p className="text-green-300 text-sm mb-5 leading-relaxed">
          Type your name exactly as it appears on your Nationals entry. No account, no password —
          this only looks you up in the published running order.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            disabled={submitting}
            autoFocus
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-white placeholder-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-400/50 disabled:opacity-50"
          />
          <input
            type="text"
            placeholder="Surname"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            disabled={submitting}
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-white placeholder-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-400/50 disabled:opacity-50"
          />
          {error && <p className="text-red-300 text-xs leading-relaxed">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Search size={15} />
            Find my entries
          </button>
        </form>
      </div>
      <p className="text-center text-green-600 text-xs mt-4">
        Your name is only stored on this device, to remember your entries next time.
      </p>
    </div>
  )
}

function EntryChecklist({ groups, checkedIds, onToggle }) {
  return (
    <div className="space-y-4">
      {groups.map(group => (
        <div key={group.horseName} className="rounded-xl bg-white/5 border border-white/10 p-3">
          <p className="text-white font-semibold text-sm mb-2">{group.horseName}</p>
          <div className="space-y-1.5">
            {group.entries.map(entry => (
              <label
                key={entry.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(entry.id)}
                  onChange={() => onToggle(entry.id)}
                  className="h-4 w-4 rounded border-white/30 bg-white/10 text-green-500 focus:ring-green-400/50 flex-shrink-0"
                />
                <span className="text-green-100 text-sm flex-1 min-w-0">
                  {entry.game || 'Game TBC'}
                  {entry.session_label ? <span className="text-green-400"> · {entry.session_label}</span> : null}
                </span>
                <span className="text-green-400 text-xs flex-shrink-0 text-right">
                  {entry.arena ? <span className="block text-green-500">{entry.arena}</span> : null}
                  {entry.scheduled_time || (entry.run_number != null ? `Run ${entry.run_number}` : '')}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SelectStep({ groups, checkedIds, onToggle, onConfirm, onBack }) {
  const anyChecked = checkedIds.size > 0
  return (
    <div className="w-full max-w-lg mx-auto px-4 pb-14">
      <div className="bg-white/10 border border-white/20 rounded-2xl p-5 sm:p-6">
        <h2 className="text-white font-bold text-lg mb-1">Which of these are you?</h2>
        <p className="text-green-300 text-sm mb-5 leading-relaxed">
          We found these entries under that name. Tick every horse and run that's yours.
        </p>

        <EntryChecklist groups={groups} checkedIds={checkedIds} onToggle={onToggle} />

        <div className="flex gap-2 mt-5">
          <button
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl bg-white/10 text-green-200 border border-white/20 hover:bg-white/20 hover:text-white text-sm font-semibold transition"
          >
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={!anyChecked}
            className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={16} />
            Show my program
          </button>
        </div>
      </div>
    </div>
  )
}

function NotFoundStep({ error, onRetry }) {
  return (
    <div className="w-full max-w-sm mx-auto px-4 pb-14 text-center">
      <div className="bg-white/10 border border-white/20 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-2">No entries found</h2>
        <p className="text-green-300 text-sm leading-relaxed">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 text-xs text-green-400 underline hover:text-green-300 transition"
        >
          Try a different name
        </button>
      </div>
    </div>
  )
}

function LevelBadge({ level, compact }) {
  if (level === null || level === undefined) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold ${LEVEL_COLORS[level]} ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      Level {level} · {LEVEL_LABELS[level]}
    </span>
  )
}

function RunTimesEntry({ entry, saved, onChange }) {
  const [run1, setRun1] = useState(saved?.run1 ?? '')
  const [run2, setRun2] = useState(saved?.run2 ?? '')

  function update(next1, next2) {
    setRun1(next1)
    setRun2(next2)
    onChange(entry.id, entry.game, next1, next2)
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        type="number" step="0.001" min="0" placeholder="Run 1 (sec)"
        value={run1}
        onChange={e => update(e.target.value, run2)}
        className="w-28 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-white placeholder-green-400/50 focus:outline-none focus:ring-2 focus:ring-green-400/50"
      />
      <input
        type="number" step="0.001" min="0" placeholder="Run 2 (sec)"
        value={run2}
        onChange={e => update(run1, e.target.value)}
        className="w-28 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-white placeholder-green-400/50 focus:outline-none focus:ring-2 focus:ring-green-400/50"
      />
      {saved?.best != null && (
        <span className="text-green-300 text-xs font-semibold">Best {saved.best.toFixed(3)}s</span>
      )}
      <LevelBadge level={saved?.level} />
    </div>
  )
}

function EmptyPanel({ text }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-green-400 text-sm">
      {text}
    </div>
  )
}

const SELECT_CLASS =
  'rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-400/50'

function uniqueValues(list) {
  return Array.from(new Set(list.filter(v => v !== null && v !== undefined && v !== '')))
}

// Shared filter state for any flat list of entries (own schedule, a
// friend's schedule) — day / horse / game / arena / level / free text.
function useEntryFilters(entries) {
  const [day, setDay] = useState('all')
  const [horse, setHorse] = useState('all')
  const [game, setGame] = useState('all')
  const [arena, setArena] = useState('all')
  const [level, setLevel] = useState('all')
  const [search, setSearch] = useState('')

  const options = useMemo(() => ({
    days: uniqueValues(entries.map(e => e.day)),
    horses: uniqueValues(entries.map(e => e.horse_name)).sort(),
    games: uniqueValues(entries.map(e => e.game)).sort(),
    arenas: uniqueValues(entries.map(e => e.arena)).sort(),
    levels: uniqueValues(entries.map(e => e.level)).sort(),
  }), [entries])

  // If the underlying entry list changes (Edit, horse tab switch) and the
  // active filter value no longer applies to anything, fall back to "all"
  // instead of silently showing zero rows.
  useEffect(() => { if (day !== 'all' && !options.days.includes(day)) setDay('all') }, [options.days, day])
  useEffect(() => { if (horse !== 'all' && !options.horses.includes(horse)) setHorse('all') }, [options.horses, horse])
  useEffect(() => { if (game !== 'all' && !options.games.includes(game)) setGame('all') }, [options.games, game])
  useEffect(() => { if (arena !== 'all' && !options.arenas.includes(arena)) setArena('all') }, [options.arenas, arena])
  useEffect(() => { if (level !== 'all' && !options.levels.includes(level)) setLevel('all') }, [options.levels, level])

  const filtered = useMemo(() => entries.filter(e => {
    if (day !== 'all' && e.day !== day) return false
    if (horse !== 'all' && e.horse_name !== horse) return false
    if (game !== 'all' && e.game !== game) return false
    if (arena !== 'all' && e.arena !== arena) return false
    if (level !== 'all' && e.level !== level) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const haystack = `${e.game || ''} ${e.horse_name || ''} ${e.arena || ''} ${e.session_label || ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  }), [entries, day, horse, game, arena, level, search])

  const active = day !== 'all' || horse !== 'all' || game !== 'all' || arena !== 'all' || level !== 'all' || !!search.trim()

  function clear() {
    setDay('all'); setHorse('all'); setGame('all'); setArena('all'); setLevel('all'); setSearch('')
  }

  return {
    filtered,
    options,
    active,
    clear,
    values: { day, horse, game, arena, level, search },
    setters: { setDay, setHorse, setGame, setArena, setLevel, setSearch },
  }
}

function FilterBar({ options, values, setters, active, onClear }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <input
        type="text"
        placeholder="Search game or horse…"
        value={values.search}
        onChange={e => setters.setSearch(e.target.value)}
        className="flex-1 min-w-[160px] rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-green-400/50 focus:outline-none focus:ring-2 focus:ring-green-400/50"
      />
      {options.days.length > 1 && (
        <select value={values.day} onChange={e => setters.setDay(e.target.value)} className={SELECT_CLASS} style={{ colorScheme: 'dark' }}>
          <option value="all" className="bg-green-900">All days</option>
          {options.days.map(d => <option key={d} value={d} className="bg-green-900">{formatDay(d)}</option>)}
        </select>
      )}
      {options.horses.length > 1 && (
        <select value={values.horse} onChange={e => setters.setHorse(e.target.value)} className={SELECT_CLASS} style={{ colorScheme: 'dark' }}>
          <option value="all" className="bg-green-900">All horses</option>
          {options.horses.map(h => <option key={h} value={h} className="bg-green-900">{h}</option>)}
        </select>
      )}
      {options.games.length > 1 && (
        <select value={values.game} onChange={e => setters.setGame(e.target.value)} className={SELECT_CLASS} style={{ colorScheme: 'dark' }}>
          <option value="all" className="bg-green-900">All games</option>
          {options.games.map(g => <option key={g} value={g} className="bg-green-900">{g}</option>)}
        </select>
      )}
      {options.arenas.length > 1 && (
        <select value={values.arena} onChange={e => setters.setArena(e.target.value)} className={SELECT_CLASS} style={{ colorScheme: 'dark' }}>
          <option value="all" className="bg-green-900">All arenas</option>
          {options.arenas.map(a => <option key={a} value={a} className="bg-green-900">{a}</option>)}
        </select>
      )}
      {options.levels.length > 1 && (
        <select value={values.level} onChange={e => setters.setLevel(e.target.value)} className={SELECT_CLASS} style={{ colorScheme: 'dark' }}>
          <option value="all" className="bg-green-900">All levels</option>
          {options.levels.map(l => <option key={l} value={l} className="bg-green-900">Level {l}</option>)}
        </select>
      )}
      {active && (
        <button
          onClick={onClear}
          className="px-3 py-2 rounded-lg bg-white/10 text-green-300 border border-white/20 hover:bg-white/20 hover:text-white text-xs font-semibold transition"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

function ScheduleTableRow({ entry, saved, onTimeChange }) {
  const [run1, setRun1] = useState(saved?.run1 ?? '')
  const [run2, setRun2] = useState(saved?.run2 ?? '')

  function update(next1, next2) {
    setRun1(next1)
    setRun2(next2)
    onTimeChange(entry.id, entry.game, next1, next2)
  }

  return (
    <tr className="hover:bg-white/5 transition">
      <td className="px-2 sm:px-3 py-2 text-green-200 whitespace-nowrap sm:whitespace-normal">{formatDayShort(entry.day)}</td>
      <td className="px-2 sm:px-3 py-2 text-green-300 font-bold whitespace-nowrap sm:whitespace-normal">{entry.scheduled_time || '—'}</td>
      <td className="px-2 sm:px-3 py-2 text-green-500 font-semibold whitespace-nowrap sm:whitespace-normal">{entry.arena || '—'}</td>
      <td className="px-2 sm:px-3 py-2 text-white font-semibold whitespace-nowrap sm:whitespace-normal">{entry.game || 'Game TBC'}</td>
      <td className="px-2 sm:px-3 py-2 text-green-300 whitespace-nowrap sm:whitespace-normal">{entry.horse_name}</td>
      <td className="px-2 sm:px-3 py-2 text-green-400 whitespace-nowrap sm:whitespace-normal">{entry.level ?? '—'}</td>
      {onTimeChange && (
        <>
          <td className="px-1.5 sm:px-2 py-2">
            <input
              type="number" step="0.001" min="0" placeholder="Run 1"
              value={run1}
              onChange={e => update(e.target.value, run2)}
              className="w-20 sm:w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-xs text-white text-right placeholder-green-400/40 focus:outline-none focus:ring-2 focus:ring-green-400/50"
            />
          </td>
          <td className="px-1.5 sm:px-2 py-2">
            <input
              type="number" step="0.001" min="0" placeholder="Run 2"
              value={run2}
              onChange={e => update(run1, e.target.value)}
              className="w-20 sm:w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-xs text-white text-right placeholder-green-400/40 focus:outline-none focus:ring-2 focus:ring-green-400/50"
            />
          </td>
          <td className="px-2 sm:px-3 py-2 text-right text-white font-semibold whitespace-nowrap sm:whitespace-normal">
            {saved?.best != null ? saved.best.toFixed(3) : '—'}
          </td>
          <td className="px-2 sm:px-3 py-2 text-right">
            {saved?.level != null ? <LevelBadge level={saved.level} compact /> : <span className="text-green-600">—</span>}
          </td>
        </>
      )}
    </tr>
  )
}

// A filterable table of entries. Pass `onTimeChange` for the editable "my
// schedule" view (two run inputs + live level); omit it for a read-only
// view (a friend's schedule).
function ScheduleTable({ entries, timesById, onTimeChange, emptyText }) {
  const { filtered, options, active, clear, values, setters } = useEntryFilters(entries)

  if (!entries.length) return <EmptyPanel text={emptyText} />

  return (
    <div>
      <FilterBar options={options} values={values} setters={setters} active={active} onClear={clear} />
      {!filtered.length ? (
        <EmptyPanel text="No runs match these filters." />
      ) : (
        <div className="overflow-x-auto sm:overflow-visible rounded-2xl border border-white/20 bg-white/5">
          <table className="w-full table-auto sm:table-fixed text-xs sm:text-sm">
            <thead className="bg-white/10 text-green-300 uppercase text-[10px] sm:text-xs">
              <tr>
                <th className={`px-2 sm:px-3 py-2 text-left ${onTimeChange ? 'sm:w-[10%]' : 'sm:w-[16%]'}`}>Day</th>
                <th className={`px-2 sm:px-3 py-2 text-left ${onTimeChange ? 'sm:w-[9%]' : 'sm:w-[14%]'}`}>Time</th>
                <th className={`px-2 sm:px-3 py-2 text-left ${onTimeChange ? 'sm:w-[8%]' : 'sm:w-[12%]'}`}>Arena</th>
                <th className={`px-2 sm:px-3 py-2 text-left ${onTimeChange ? 'sm:w-[12%]' : 'sm:w-[20%]'}`}>Game</th>
                <th className={`px-2 sm:px-3 py-2 text-left ${onTimeChange ? 'sm:w-[13%]' : 'sm:w-[26%]'}`}>Horse</th>
                <th className={`px-2 sm:px-3 py-2 text-left ${onTimeChange ? 'sm:w-[6%]' : 'sm:w-[12%]'}`}>Level</th>
                {onTimeChange && (
                  <>
                    <th className="px-1.5 sm:px-2 py-2 text-right sm:w-[9%]">Run 1</th>
                    <th className="px-1.5 sm:px-2 py-2 text-right sm:w-[9%]">Run 2</th>
                    <th className="px-2 sm:px-3 py-2 text-right sm:w-[8%]">Best</th>
                    <th className="px-2 sm:px-3 py-2 text-right sm:w-[16%]">Achieved</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map(entry => (
                <ScheduleTableRow
                  key={entry.id}
                  entry={entry}
                  saved={timesById?.[entry.id]}
                  onTimeChange={onTimeChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-green-500 text-xs mt-2">{filtered.length} of {entries.length} runs shown</p>
    </div>
  )
}

function AddFriendForm({ entries, onAdd, onCancel }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phase, setPhase] = useState('search') // search | select | notfound
  const [candidates, setCandidates] = useState([])
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [error, setError] = useState('')

  function handleSearch(e) {
    e.preventDefault()
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter a first name and surname.')
      return
    }
    const matches = findEntriesForName(entries, firstName.trim(), lastName.trim())
    if (!matches.length) {
      setPhase('notfound')
      return
    }
    setCandidates(matches)
    setCheckedIds(new Set(matches.map(m => m.id)))
    setPhase('select')
  }

  function toggle(id) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function confirm() {
    if (!checkedIds.size) return
    onAdd({
      id: newFriendId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      selectedEntryIds: Array.from(checkedIds),
    })
  }

  const groups = useMemo(() => groupByHorse(candidates), [candidates])

  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl p-5 mb-4">
      {phase === 'search' && (
        <form onSubmit={handleSearch} className="space-y-3">
          <p className="text-white font-semibold text-sm">Add a friend</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text" placeholder="First name" value={firstName} autoFocus
              onChange={e => setFirstName(e.target.value)}
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-400/50"
            />
            <input
              type="text" placeholder="Surname" value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-400/50"
            />
          </div>
          {error && <p className="text-red-300 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="px-3 py-2 rounded-xl bg-white/10 text-green-200 border border-white/20 hover:bg-white/20 hover:text-white text-xs font-semibold transition">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition">
              Search
            </button>
          </div>
        </form>
      )}

      {phase === 'notfound' && (
        <div className="text-center py-2">
          <p className="text-green-300 text-sm mb-3">Couldn't find that name in the published running order.</p>
          <button onClick={() => setPhase('search')} className="text-xs text-green-400 underline hover:text-green-300 transition">
            Try again
          </button>
        </div>
      )}

      {phase === 'select' && (
        <div>
          <p className="text-white font-semibold text-sm mb-3">Which entries are {firstName}'s?</p>
          <EntryChecklist groups={groups} checkedIds={checkedIds} onToggle={toggle} />
          <div className="flex gap-2 mt-4">
            <button onClick={onCancel} className="px-3 py-2 rounded-xl bg-white/10 text-green-200 border border-white/20 hover:bg-white/20 hover:text-white text-xs font-semibold transition">
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={!checkedIds.size}
              className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition disabled:opacity-40"
            >
              Add friend
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FriendCard({ friend, entries, expanded, onToggle, onRemove }) {
  const friendEntries = useMemo(() => entriesForIds(entries, friend.selectedEntryIds), [entries, friend.selectedEntryIds])
  const horseNames = useMemo(() => {
    const set = new Set(friendEntries.map(e => e.horse_name).filter(Boolean))
    return Array.from(set)
  }, [friendEntries])

  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 text-left hover:bg-white/5 transition"
      >
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm">{friend.firstName} {friend.lastName}</p>
          <p className="text-green-400 text-xs mt-0.5 truncate">{horseNames.join(', ') || 'No horses selected'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-green-500 text-xs">{friend.selectedEntryIds.length} runs</span>
          <ChevronDown size={16} className={`text-green-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="border-t border-white/10 px-4 sm:px-5 py-4">
          <ScheduleTable entries={friendEntries} emptyText="No entries selected for this friend." />
          <button onClick={onRemove} className="mt-3 text-xs text-red-300 hover:text-red-200 transition">
            Remove friend
          </button>
        </div>
      )}
    </div>
  )
}

function FriendsView({ entries, friends, onAddFriend, onRemoveFriend }) {
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-lg">Friends</h2>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-500 hover:bg-green-400 text-white transition"
          >
            <UserPlus size={14} />
            Add a friend
          </button>
        )}
      </div>

      {showAdd && (
        <AddFriendForm
          entries={entries}
          onCancel={() => setShowAdd(false)}
          onAdd={friend => { onAddFriend(friend); setShowAdd(false) }}
        />
      )}

      {friends.length === 0 ? (
        <EmptyPanel text="No friends added yet — search for someone above to see their schedule." />
      ) : (
        <div className="space-y-3">
          {friends.map(friend => (
            <FriendCard
              key={friend.id}
              friend={friend}
              entries={entries}
              expanded={expandedId === friend.id}
              onToggle={() => setExpandedId(expandedId === friend.id ? null : friend.id)}
              onRemove={() => onRemoveFriend(friend.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TimesView({ myEntries, visitor }) {
  const rows = myEntries.map(entry => {
    const t = visitor.times?.[entry.id]
    return { entry, run1: t?.run1 || '', run2: t?.run2 || '', best: t?.best ?? null, level: t?.level ?? null }
  })
  const complete = rows.filter(r => r.run1 !== '' && r.run2 !== '').length
  const total = rows.length

  if (!total) return <EmptyPanel text="No entries selected yet — find your entries first." />

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-bold text-lg">Your times</h2>
        <span className="text-green-400 text-xs font-semibold">{complete} / {total} runs logged</span>
      </div>
      {complete === total && (
        <div className="mb-4 rounded-xl border border-green-400/40 bg-green-400/10 px-4 py-2.5 text-green-300 text-sm font-semibold flex items-center gap-2">
          <Trophy size={15} className="text-yellow-400" />
          All times are in — here's your full table.
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-white/20 bg-white/5">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-white/10 text-green-300 uppercase text-[10px] sm:text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Day</th>
              <th className="px-3 py-2 text-left">Game</th>
              <th className="px-3 py-2 text-left">Horse</th>
              <th className="px-3 py-2 text-left">Arena</th>
              <th className="px-3 py-2 text-right">Run 1</th>
              <th className="px-3 py-2 text-right">Run 2</th>
              <th className="px-3 py-2 text-right">Best</th>
              <th className="px-3 py-2 text-right">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map(({ entry, run1, run2, best, level }) => (
              <tr key={entry.id}>
                <td className="px-3 py-2 text-green-200 whitespace-nowrap">{formatDay(entry.day)}</td>
                <td className="px-3 py-2 text-white font-semibold whitespace-nowrap">{entry.game}</td>
                <td className="px-3 py-2 text-green-300 whitespace-nowrap">{entry.horse_name}</td>
                <td className="px-3 py-2 text-green-400 whitespace-nowrap">{entry.arena || '—'}</td>
                <td className="px-3 py-2 text-right text-green-100">{run1 || '—'}</td>
                <td className="px-3 py-2 text-right text-green-100">{run2 || '—'}</td>
                <td className="px-3 py-2 text-right text-white font-semibold">{best != null ? best.toFixed(3) : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {level != null ? <LevelBadge level={level} compact /> : <span className="text-green-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const NAV_ITEMS = [
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'live', label: 'Live Day', icon: PlayCircle },
  { key: 'friends', label: 'Friends', icon: Users },
  { key: 'times', label: 'Times', icon: ListChecks },
  { key: 'leveltarget', label: 'Level Target', icon: Target },
  { key: 'export', label: 'Export PDF', icon: Download },
  { key: 'ridercard', label: 'Rider Card', icon: IdCard },
]

function NavButtons({ active, onChange, itemClassName }) {
  return (
    <>
      {NAV_ITEMS.map(item => {
        const Icon = item.icon
        const isActive = active === item.key
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${itemClassName} ${
              isActive
                ? 'bg-green-500 text-white'
                : 'bg-white/10 text-green-200 border border-white/10 hover:bg-white/20 hover:text-white'
            }`}
          >
            <Icon size={16} />
            {item.label}
          </button>
        )
      })}
      <Link
        to="/klippies"
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-green-200 border border-white/10 hover:bg-white/20 hover:text-white transition ${itemClassName}`}
      >
        <Sparkles size={16} />
        Klippies
      </Link>
    </>
  )
}

// Mobile-only trigger bar: shows the current section and opens the slide-out
// nav drawer. Hidden at sm+ where the sidebar is always visible instead.
function MobileNavTrigger({ active, onOpen }) {
  const activeItem = NAV_ITEMS.find(item => item.key === active)
  const Icon = activeItem?.icon || Menu
  return (
    <button
      onClick={onOpen}
      className="sm:hidden w-full flex items-center gap-2.5 px-4 py-3 mb-4 rounded-xl bg-white/10 border border-white/20 text-white transition hover:bg-white/20"
    >
      <Menu size={18} className="text-green-400 flex-shrink-0" />
      <Icon size={16} className="flex-shrink-0" />
      <span className="text-sm font-semibold">{activeItem?.label || 'Menu'}</span>
    </button>
  )
}

// Mobile-only slide-out drawer version of the nav, opened via MobileNavTrigger.
function MobileNavDrawer({ active, onChange, open, onClose }) {
  if (!open) return null
  return (
    <div className="sm:hidden">
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed left-0 top-0 bottom-0 w-72 max-w-[80vw] bg-green-950 border-r border-green-800/60 z-50 flex flex-col p-4 gap-1.5 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-bold text-sm">Menu</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-green-400 hover:text-white hover:bg-white/10 transition">
            <X size={18} />
          </button>
        </div>
        <NavButtons
          active={active}
          onChange={key => { onChange(key); onClose() }}
          itemClassName="w-full"
        />
      </div>
    </div>
  )
}

// Desktop sidebar (always visible, sm+) plus the mobile trigger/drawer pair
// (hidden at sm+, where the sidebar takes over).
function SideNav({ active, onChange, mobileOpen, onMobileOpen, onMobileClose }) {
  return (
    <>
      <MobileNavTrigger active={active} onOpen={onMobileOpen} />
      <MobileNavDrawer active={active} onChange={onChange} open={mobileOpen} onClose={onMobileClose} />
      <nav className="hidden sm:flex sm:flex-col gap-1.5 sm:w-40 flex-shrink-0">
        <NavButtons active={active} onChange={onChange} itemClassName="sm:w-full" />
      </nav>
    </>
  )
}

function HorseTabs({ horses, active, onChange }) {
  if (horses.length < 2) return null
  return (
    <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1" style={{ scrollbarWidth: 'none' }}>
      <button
        onClick={() => onChange('all')}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
          active === 'all'
            ? 'bg-green-500 text-white'
            : 'bg-white/10 text-green-200 border border-white/10 hover:bg-white/20 hover:text-white'
        }`}
      >
        All horses
      </button>
      {horses.map(h => (
        <button
          key={h}
          onClick={() => onChange(h)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
            active === h
              ? 'bg-green-500 text-white'
              : 'bg-white/10 text-green-200 border border-white/10 hover:bg-white/20 hover:text-white'
          }`}
        >
          {h}
        </button>
      ))}
    </div>
  )
}

function DayTabs({ days, active, onChange }) {
  if (days.length < 2) return null
  return (
    <div className="flex gap-1.5 overflow-x-auto mb-3 pb-1" style={{ scrollbarWidth: 'none' }}>
      {days.map(day => (
        <button
          key={day}
          onClick={() => onChange(day)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
            active === day
              ? 'bg-green-500 text-white'
              : 'bg-white/10 text-green-200 border border-white/10 hover:bg-white/20 hover:text-white'
          }`}
        >
          {formatDay(day)}
        </button>
      ))}
    </div>
  )
}

function LiveDayView({ myEntries, visitor, onTimeChange }) {
  const days = useMemo(() => {
    const seen = new Set()
    const list = []
    for (const e of sortEntries(myEntries)) {
      if (e.day && !seen.has(e.day)) { seen.add(e.day); list.push(e.day) }
    }
    return list
  }, [myEntries])

  const todayStr = new Date().toISOString().split('T')[0]
  const [selectedDay, setSelectedDay] = useState(() => (days.includes(todayStr) ? todayStr : days[0] || null))

  useEffect(() => {
    if (selectedDay && !days.includes(selectedDay)) setSelectedDay(days[0] || null)
    if (!selectedDay && days.length) setSelectedDay(days.includes(todayStr) ? todayStr : days[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const dayEntries = useMemo(
    () => sortEntries(myEntries.filter(e => e.day === selectedDay)),
    [myEntries, selectedDay]
  )

  const dayHorses = useMemo(() => {
    const seen = new Set()
    const list = []
    for (const e of dayEntries) {
      if (e.horse_name && !seen.has(e.horse_name)) { seen.add(e.horse_name); list.push(e.horse_name) }
    }
    return list
  }, [dayEntries])

  const [selectedHorse, setSelectedHorse] = useState('all')
  useEffect(() => {
    if (selectedHorse !== 'all' && !dayHorses.includes(selectedHorse)) setSelectedHorse(dayHorses[0] || 'all')
  }, [dayHorses, selectedHorse])

  const runEntries = useMemo(
    () => (selectedHorse === 'all' ? dayEntries : dayEntries.filter(e => e.horse_name === selectedHorse)),
    [dayEntries, selectedHorse]
  )

  const [index, setIndex] = useState(0)
  useEffect(() => { setIndex(0) }, [selectedDay, selectedHorse])

  if (!days.length) return <EmptyPanel text="No entries selected yet — find your entries first." />

  const current = runEntries[index]

  return (
    <div>
      <DayTabs days={days} active={selectedDay} onChange={setSelectedDay} />
      <HorseTabs horses={dayHorses} active={selectedHorse} onChange={setSelectedHorse} />

      {!current ? (
        <EmptyPanel text="No runs for this horse on this day." />
      ) : (
        <div className="bg-white/10 border border-white/20 rounded-3xl p-6 sm:p-8 text-center">
          <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-2">
            Run {index + 1} of {runEntries.length}
          </p>
          <h2 className="text-white font-bold text-2xl sm:text-3xl mb-1">{current.game || 'Game TBC'}</h2>
          <p className="text-green-300 text-sm mb-4">
            {current.horse_name}
            {current.session_label ? ` · ${current.session_label}` : ''}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {current.arena && (
              <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-green-200 text-sm font-semibold">
                {current.arena}
              </span>
            )}
            {current.scheduled_time && (
              <span className="px-3 py-1.5 rounded-full bg-green-500/20 border border-green-400/40 text-green-200 text-sm font-bold">
                {current.scheduled_time}
              </span>
            )}
            {current.run_number != null && (
              <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-green-400 text-sm">
                Run #{current.run_number}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center">
            <RunTimesEntry entry={current} saved={visitor.times?.[current.id]} onChange={onTimeChange} />
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={() => setIndex(i => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/10 text-green-200 border border-white/20 hover:bg-white/20 hover:text-white text-sm font-bold transition disabled:opacity-30"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              onClick={() => setIndex(i => Math.min(runEntries.length - 1, i + 1))}
              disabled={index === runEntries.length - 1}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition disabled:opacity-30"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LevelPicker({ active, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap mb-5">
      {[0, 1, 2, 3, 4].map(lvl => (
        <button
          key={lvl}
          onClick={() => onChange(lvl)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
            active === lvl
              ? 'bg-green-500 text-white'
              : 'bg-white/10 text-green-200 border border-white/10 hover:bg-white/20 hover:text-white'
          }`}
        >
          Level {lvl} · {LEVEL_LABELS[lvl]}
        </button>
      ))}
    </div>
  )
}

function LevelTargetRow({ game, targetLevel, saved, onChange }) {
  const [run1, setRun1] = useState(saved?.run1 ?? '')
  const [run2, setRun2] = useState(saved?.run2 ?? '')

  function update(next1, next2) {
    setRun1(next1)
    setRun2(next2)
    onChange(game, next1, next2)
  }

  const thresholds = MATRIX[game]
  const [min, max] = thresholds[targetLevel]
  const windowLabel = `${min.toFixed(3)}s – ${max === Infinity ? '+' : max.toFixed(3) + 's'}`

  const best = saved?.best
  const actualLevel = saved?.level

  let status = null
  if (best != null && actualLevel != null) {
    if (actualLevel === targetLevel) status = { text: `On track for Level ${targetLevel}`, tone: 'good', emoji: '✅' }
    else if (actualLevel > targetLevel) status = { text: `Faster than target — this would bump you up to Level ${actualLevel}`, tone: 'warn', emoji: '⚠️' }
    else status = { text: `Slower than target — this would drop you to Level ${actualLevel}`, tone: 'bad', emoji: '🐢' }
  }

  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-5">
      <p className="text-white font-semibold text-sm">{game}</p>
      <p className="text-green-400 text-xs mt-0.5">Stay in Level {targetLevel}: {windowLabel}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number" step="0.001" min="0" placeholder="Run 1 (sec)"
          value={run1}
          onChange={e => update(e.target.value, run2)}
          className="w-28 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-white placeholder-green-400/50 focus:outline-none focus:ring-2 focus:ring-green-400/50"
        />
        <input
          type="number" step="0.001" min="0" placeholder="Run 2 (sec)"
          value={run2}
          onChange={e => update(run1, e.target.value)}
          className="w-28 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-white placeholder-green-400/50 focus:outline-none focus:ring-2 focus:ring-green-400/50"
        />
        {best != null && (
          <span className="text-green-300 text-xs font-semibold">Best {best.toFixed(3)}s</span>
        )}
      </div>

      {status && (
        <p className={`mt-2 text-xs font-semibold ${
          status.tone === 'good' ? 'text-green-300' : status.tone === 'warn' ? 'text-yellow-300' : 'text-orange-300'
        }`}>
          {status.emoji} {status.text}
        </p>
      )}
    </div>
  )
}

function LevelTargetView({ visitor, onTargetLevelChange, onLevelTimeChange }) {
  const targetLevel = visitor.targetLevel ?? null

  return (
    <div>
      <h2 className="text-white font-bold text-lg mb-1">Level target</h2>
      <p className="text-green-300 text-sm mb-4 leading-relaxed">
        Pick the level you want to stay in this season. Each game below shows the time window that
        keeps you there — ride faster and you'll bump up a level, slower and you'll drop.
      </p>

      <LevelPicker active={targetLevel} onChange={onTargetLevelChange} />

      {targetLevel === null ? (
        <EmptyPanel text="Choose a level above to see the pace you need to hold in each game." />
      ) : (
        <div className="space-y-3">
          {GAMES.map(game => (
            <LevelTargetRow
              key={game}
              game={game}
              targetLevel={targetLevel}
              saved={visitor.levelCheckTimes?.[game]}
              onChange={onLevelTimeChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExportView({ options, target, onTargetChange, onDownload }) {
  const selected = options.find(o => o.id === target) || options[0]
  return (
    <div>
      <h2 className="text-white font-bold text-lg mb-1">Export PDF</h2>
      <p className="text-green-300 text-sm mb-5 leading-relaxed">
        A printable program for yourself or a friend — every horse, run, arena and time in one document.
        {selected?.id !== 'me' && ' Friends only have their schedule stored, not times, since times aren’t logged on their behalf.'}
      </p>

      <div className="flex gap-2 flex-wrap mb-5">
        {options.map(o => (
          <button
            key={o.id}
            onClick={() => onTargetChange(o.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
              target === o.id
                ? 'bg-green-500 text-white'
                : 'bg-white/10 text-green-200 border border-white/10 hover:bg-white/20 hover:text-white'
            }`}
          >
            {o.firstName} {o.lastName}{o.id === 'me' ? ' (you)' : ''}
          </button>
        ))}
      </div>

      {selected && (
        <p className="text-green-500 text-xs mb-4">
          {selected.selectedEntryIds?.length || 0} runs will be included.
        </p>
      )}

      <button
        onClick={onDownload}
        disabled={!selected || !selected.selectedEntryIds?.length}
        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition disabled:opacity-40"
      >
        <Download size={16} />
        Download {selected?.firstName ? `${selected.firstName}'s` : ''} PDF
      </button>
    </div>
  )
}

// A logged time if there is one, otherwise a blank line long enough to
// write a time on by hand — for a friend (never digitally tracked) or any
// of your own runs you haven't logged yet.
function WritableCell({ value }) {
  if (value) return <>{value}</>
  return <span style={{ display: 'inline-block', width: '40px', borderBottom: '1px solid #9ca3af' }}>&nbsp;</span>
}

function PrintExportArea({ target, entries, event }) {
  const targetEntries = target ? entriesForIds(entries, target.selectedEntryIds) : []
  const groups = groupByHorse(targetEntries)
  const dateLabel = event
    ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const hasComputed = !!target?.times

  const content = (
    <div id="nationals-print-area" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', background: 'white' }}>
      <div className="p-10 text-gray-900">
        <div className="flex items-center justify-between border-b-2 border-gray-900 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <img src={APP_LOGO_SRC} alt="KlipKlop" className="h-12 w-12 object-contain" />
            <div>
              <p className="font-black text-xl leading-tight">KlipKlop</p>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Nationals 2026</p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            {event && <p>{event.venue}{event.province ? `, ${event.province}` : ''}</p>}
            {dateLabel && <p>{dateLabel}</p>}
          </div>
        </div>

        <h1 className="text-2xl font-black mb-1">{target?.firstName} {target?.lastName}</h1>
        <p className="text-sm text-gray-500 mb-6">
          {targetEntries.length} run{targetEntries.length === 1 ? '' : 's'} across {groups.length} horse{groups.length === 1 ? '' : 's'}
        </p>

        {groups.map(group => (
          <div key={group.horseName} className="mb-6" style={{ breakInside: 'avoid' }}>
            <h2 className="text-base font-bold mb-2 bg-gray-100 px-3 py-1.5 rounded">{group.horseName}</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left text-gray-500 uppercase text-[10px]">
                  <th className="py-1.5 pr-2">Day</th>
                  <th className="py-1.5 pr-2">Time</th>
                  <th className="py-1.5 pr-2">Arena</th>
                  <th className="py-1.5 pr-2">Game</th>
                  <th className="py-1.5 pr-2">Level</th>
                  <th className="py-1.5 pr-2 text-right">Run 1</th>
                  <th className="py-1.5 pr-2 text-right">Run 2</th>
                  {hasComputed && (
                    <>
                      <th className="py-1.5 pr-2 text-right">Best</th>
                      <th className="py-1.5 text-right">Achieved</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {group.entries.map(entry => {
                  const t = target?.times?.[entry.id]
                  return (
                    <tr key={entry.id} className="border-b border-gray-100">
                      <td className="py-1.5 pr-2">{formatDayShort(entry.day)}</td>
                      <td className="py-1.5 pr-2 font-semibold">{entry.scheduled_time || '—'}</td>
                      <td className="py-1.5 pr-2">{entry.arena || '—'}</td>
                      <td className="py-1.5 pr-2 font-semibold">{entry.game || '—'}</td>
                      <td className="py-1.5 pr-2">{entry.level ?? '—'}</td>
                      <td className="py-1.5 pr-2 text-right"><WritableCell value={t?.run1} /></td>
                      <td className="py-1.5 pr-2 text-right"><WritableCell value={t?.run2} /></td>
                      {hasComputed && (
                        <>
                          <td className="py-1.5 pr-2 text-right font-semibold">{t?.best != null ? t.best.toFixed(3) : '—'}</td>
                          <td className="py-1.5 text-right">{t?.level != null ? `L${t.level}` : '—'}</td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

        <p className="text-[10px] text-gray-400 mt-8 pt-4 border-t border-gray-200">
          Generated by KlipKlop · klipklop.co.za/nationals · {new Date().toLocaleDateString('en-ZA')}
        </p>
      </div>
    </div>
  )

  // Rendered via portal, as a direct child of <body> — not nested inside the
  // app's own layout tree — so the print stylesheet can hide literally
  // everything else with a single rule and let this content sit in normal
  // document flow, which is what lets it paginate across as many physical
  // pages as it needs. (An earlier version pinned this area with
  // position:fixed so it would start at the top of page 1, but fixed-position
  // content in print is clipped to one page's height — anything past it was
  // silently cut off instead of flowing to page 2, which is why a rider with
  // more than ~3 horses only ever saw the first 3 in their downloaded PDF.)
  return createPortal(content, document.body)
}

function handleExportPdf() {
  const existing = document.getElementById('nationals-print-style')
  if (existing) existing.remove()

  const style = document.createElement('style')
  style.id = 'nationals-print-style'
  style.textContent = `
    @media print {
      @page { size: A4 portrait; margin: 12mm; }
      body > *:not(#nationals-print-area) { display: none !important; }
      #nationals-print-area {
        position: static !important;
        top: auto !important;
        left: auto !important;
        width: 100% !important;
        background: white !important;
      }
      #nationals-print-area * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `
  document.head.appendChild(style)
  window.print()
}

// The cropper hands back a File; localStorage only stores strings, so the
// cropped photo is converted to a data URL before it's saved on the visitor.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the cropped photo.'))
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
}

const RIDER_CARD_ASPECT = 360 / 460

// html2canvas can't parse the oklch()/color-mix() colors Tailwind v4
// generates for utility classes (including every bg-x/NN or border-x/NN
// opacity variant), so every colour inside the captured card is a plain
// inline rgba()/hex value instead of a Tailwind colour class — className is
// only used here for layout (flex, spacing, radius), never colour.
const CARD_LEVEL_STYLES = [
  { text: '#d1d5db', bg: 'rgba(156,163,175,0.16)', border: 'rgba(156,163,175,0.4)' },
  { text: '#fde047', bg: 'rgba(250,204,21,0.16)', border: 'rgba(250,204,21,0.4)' },
  { text: '#93c5fd', bg: 'rgba(96,165,250,0.16)', border: 'rgba(96,165,250,0.4)' },
  { text: '#fdba74', bg: 'rgba(251,146,60,0.16)', border: 'rgba(251,146,60,0.4)' },
  { text: '#86efac', bg: 'rgba(74,222,128,0.16)', border: 'rgba(74,222,128,0.4)' },
]

function RiderCardPreview({ cardRef, riderName, horseName, number, level, photo }) {
  const lvl = level != null && CARD_LEVEL_STYLES[level] ? CARD_LEVEL_STYLES[level] : null

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden rounded-[28px] mx-auto flex flex-col"
      style={{
        width: '360px',
        height: '460px',
        background: photo
          ? `url(${photo}) center / cover no-repeat`
          : 'linear-gradient(160deg, #041b10 0%, #0d5c33 55%, #063a21 100%)',
        boxShadow: '0 24px 60px -16px rgba(0,0,0,0.65)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: photo
            ? 'linear-gradient(180deg, rgba(3,20,12,0.2) 0%, rgba(3,20,12,0.4) 40%, rgba(3,20,12,0.96) 100%)'
            : 'radial-gradient(circle at 25% 12%, rgba(74,222,128,0.22), transparent 55%)',
        }}
      />

      <div
        className="absolute inset-0 rounded-[28px] pointer-events-none"
        style={{ border: '2px solid rgba(255,255,255,0.18)' }}
      />

      {/* Foreground content sits in normal flow (not stacked absolute
          layers) so the vertical spacing stays predictable at any
          rider-name/horse-name length. */}
      <div className="relative flex flex-col h-full">
        <div className="flex items-center gap-2 px-5 pt-5">
          <img
            src={APP_LOGO_SRC}
            alt="KlipKlop"
            className="h-7 w-7 object-contain rounded-lg p-1"
            style={{ background: 'rgba(255,255,255,0.92)' }}
          />
          <span className="font-bold text-sm tracking-tight" style={{ color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
            KlipKlop
          </span>
        </div>

        <div className="mt-4 w-full" style={{ background: '#dc2626', boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}>
          <p
            className="w-full py-2"
            style={{ color: '#ffffff', fontWeight: 900, fontSize: '13px', letterSpacing: '0.08em', textShadow: '0 1px 2px rgba(0,0,0,0.3)', textAlign: 'center' }}
          >
            SAWMGA NATIONALS 2026
          </p>
        </div>

        {/* Hero block — horse + level are the emphasis, rider is secondary.
            Centering here is done with margin:auto / textAlign, not flex
            `align-items`/`justify-content`, since html2canvas doesn't
            reliably center flex children — it left this whole block
            visibly off-center in the exported PNG even though it renders
            centered on screen. The outer flex is only for vertical
            space-filling (default `stretch` on its one child), never for
            horizontal alignment. */}
        <div className="flex-1 flex flex-col justify-center w-full">
          <div className="px-6" style={{ textAlign: 'center' }}>
            {number != null && (
              <div
                className="flex flex-col items-center justify-center"
                style={{ width: '76px', height: '76px', margin: '0 auto', borderRadius: '50%', background: 'rgba(3,20,12,0.55)', border: '2px solid rgba(74,222,128,0.6)' }}
              >
                <span style={{ color: 'rgba(134,239,172,0.85)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center' }}>NO.</span>
                <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: 900, lineHeight: 1, textAlign: 'center' }}>{number}</span>
              </div>
            )}
            <p
              className="font-black leading-tight w-full"
              style={{ color: '#ffffff', fontSize: '32px', textShadow: '0 2px 10px rgba(0,0,0,0.6)', marginTop: '16px', textAlign: 'center' }}
            >
              {horseName}
            </p>
            {lvl && (
              <span
                className="inline-block"
                style={{
                  marginTop: '12px', color: lvl.text, background: lvl.bg, border: `1.5px solid ${lvl.border}`,
                  borderRadius: '9999px', padding: '6px 18px', fontSize: '15px', fontWeight: 800, letterSpacing: '0.02em', textAlign: 'center',
                }}
              >
                LEVEL {level}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 w-full">
          <p className="text-[10px] uppercase mb-0.5" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.15em', textAlign: 'center' }}>Rider</p>
          <p className="font-bold text-base" style={{ color: 'rgba(255,255,255,0.92)', textAlign: 'center' }}>{riderName}</p>
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>klipklop.co.za/nationals</p>
        </div>
      </div>
    </div>
  )
}

function RiderCardView({ visitor, myEntries, onPhotoChange }) {
  const cardRef = useRef(null)
  const fileInputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const horseCards = useMemo(() => {
    const groups = groupByHorse(myEntries)
    return groups.map(g => ({
      horseName: g.horseName,
      number: g.entries[0]?.run_number ?? null,
      level: g.entries[0]?.level != null ? Number(g.entries[0].level) : null,
    }))
  }, [myEntries])

  const [selectedHorse, setSelectedHorse] = useState(() => horseCards[0]?.horseName || null)
  useEffect(() => {
    if (!horseCards.some(h => h.horseName === selectedHorse)) {
      setSelectedHorse(horseCards[0]?.horseName || null)
    }
  }, [horseCards, selectedHorse])

  const current = horseCards.find(h => h.horseName === selectedHorse) || null
  const photo = current ? visitor.riderCardPhotos?.[current.horseName] : null

  const [cropSource, setCropSource] = useState('')
  const [cropFilename, setCropFilename] = useState('photo.jpg')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setCropFilename(file.name || 'photo.jpg')
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setCropSource(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  function closeCropModal() {
    setCropSource(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
    setCroppedAreaPixels(null)
  }

  async function handleCropConfirm() {
    if (!cropSource || !croppedAreaPixels || !current) return
    setError('')
    setBusy(true)
    try {
      const croppedFile = await createCroppedImageFile({
        imageSrc: cropSource,
        cropPixels: croppedAreaPixels,
        fileName: cropFilename.replace(/\.[^.]+$/, '') + '.jpg',
        maxDimension: 1000,
      })
      const dataUrl = await fileToDataUrl(croppedFile)
      onPhotoChange(current.horseName, dataUrl)
      closeCropModal()
    } catch {
      setError('Could not use that photo — try a different image.')
    } finally {
      setBusy(false)
    }
  }

  async function handleExportPng() {
    if (!cardRef.current || !current) return
    setError('')
    setBusy(true)
    try {
      const rendered = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: null })
      // html2canvas doesn't clip to the captured element's own border-radius,
      // so the raw render comes out square-cornered — mask it onto a rounded
      // canvas to match what the card actually looks like on screen.
      const radius = 28 * 2
      const canvas = document.createElement('canvas')
      canvas.width = rendered.width
      canvas.height = rendered.height
      const ctx = canvas.getContext('2d')
      ctx.beginPath()
      ctx.moveTo(radius, 0)
      ctx.arcTo(canvas.width, 0, canvas.width, canvas.height, radius)
      ctx.arcTo(canvas.width, canvas.height, 0, canvas.height, radius)
      ctx.arcTo(0, canvas.height, 0, 0, radius)
      ctx.arcTo(0, 0, canvas.width, 0, radius)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(rendered, 0, 0)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('empty blob')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = `${visitor.firstName} ${visitor.lastName} ${current.horseName}`.trim().replace(/\s+/g, '-').toLowerCase() || 'rider'
      a.download = `${safeName}-nationals-card.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Rider card export failed', err)
      setError('Could not export the card — try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!horseCards.length) return <EmptyPanel text="Find your entries first to build your rider card." />
  if (!current) return null

  return (
    <div>
      <h2 className="text-white font-bold text-lg mb-1">Rider card</h2>
      <p className="text-green-300 text-sm mb-5 leading-relaxed">
        One shareable card per horse — your name, this horse, your Nationals number and level. Add a riding photo and export as a PNG.
      </p>

      {horseCards.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto mb-5 pb-1 justify-center" style={{ scrollbarWidth: 'none' }}>
          {horseCards.map(h => (
            <button
              key={h.horseName}
              onClick={() => setSelectedHorse(h.horseName)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
                selectedHorse === h.horseName
                  ? 'bg-green-500 text-white'
                  : 'bg-white/10 text-green-200 border border-white/10 hover:bg-white/20 hover:text-white'
              }`}
            >
              {h.horseName}
            </button>
          ))}
        </div>
      )}

      <RiderCardPreview
        cardRef={cardRef}
        riderName={`${visitor.firstName} ${visitor.lastName}`}
        horseName={current.horseName}
        number={current.number}
        level={current.level}
        photo={photo}
      />

      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 text-green-200 border border-white/20 hover:bg-white/20 hover:text-white text-sm font-semibold transition disabled:opacity-50"
        >
          <Camera size={15} />
          {photo ? 'Change photo' : 'Add a riding photo'}
        </button>
        {photo && (
          <button
            onClick={() => onPhotoChange(current.horseName, null)}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl bg-white/10 text-green-200 border border-white/20 hover:bg-white/20 hover:text-white text-sm font-semibold transition disabled:opacity-50"
          >
            Remove photo
          </button>
        )}
        <button
          onClick={handleExportPng}
          disabled={busy}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition disabled:opacity-50"
        >
          <Download size={15} />
          {busy ? 'Working…' : `Download ${current.horseName}'s card`}
        </button>
      </div>
      {error && <p className="text-red-300 text-xs text-center mt-3">{error}</p>}

      {cropSource && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
          <div className="bg-green-950 border border-white/10 rounded-2xl shadow-xl w-full max-w-sm p-5 my-auto">
            <h3 className="text-white font-bold text-lg">Position your photo</h3>
            <p className="text-green-300 text-sm mt-1">
              Drag the photo to reposition it. Scroll your mouse wheel (or pinch with two fingers on mobile) to zoom in and out.
            </p>

            <div
              className="relative mt-4 mx-auto rounded-xl overflow-hidden bg-black"
              style={{ aspectRatio: `${RIDER_CARD_ASPECT}`, height: '360px', width: 'auto', maxWidth: '100%' }}
            >
              {/* Tailwind's preflight sets `img { max-width: 100% }` globally,
                  which fights react-easy-crop's own cover-sizing (it sizes
                  the image via `width: auto; height: 100%` or vice versa) —
                  the max-width cap was overriding the auto dimension and
                  squashing the image into the container's exact box shape.
                  This scopes the override to just the cropper's own media. */}
              <style>{`.reactEasyCrop_Image, .reactEasyCrop_Video { max-width: none !important; max-height: none !important; }`}</style>
              <Cropper
                image={cropSource}
                crop={crop}
                zoom={zoom}
                aspect={RIDER_CARD_ASPECT}
                objectFit="cover"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeCropModal}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl bg-white/10 text-green-200 border border-white/20 hover:bg-white/20 hover:text-white text-sm font-semibold transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCropConfirm}
                disabled={busy || !croppedAreaPixels}
                className="px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Use this photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Mirrors the Dashboard's own layout (header row, side nav, content card)
// so the page doesn't jump when the real content swaps in — shown while
// entries are still loading, which is the common case on a first visit.
function DashboardSkeleton() {
  const bar = 'rounded-lg bg-white/10 animate-pulse'
  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-14">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="space-y-2">
          <div className={`${bar} h-5 w-36`} />
          <div className={`${bar} h-3 w-24`} />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <div className={`${bar} h-7 w-14 rounded-full`} />
          <div className={`${bar} h-7 w-20 rounded-full`} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="hidden sm:flex sm:flex-col gap-1.5 sm:w-40 flex-shrink-0">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`${bar} h-10`} />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`${bar} h-4 w-32 mb-3`} />
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className={`${bar} h-4`} style={{ width: `${92 - i * 7}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ visitor, entries, event, activeTab, setActiveTab, onEditSelection, onNotYou, onTimeChange, onAddFriend, onRemoveFriend, onTargetLevelChange, onLevelTimeChange, onPhotoChange }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [exportTarget, setExportTarget] = useState('me')

  const exportOptions = useMemo(() => [
    { id: 'me', firstName: visitor.firstName, lastName: visitor.lastName, selectedEntryIds: visitor.selectedEntryIds, times: visitor.times },
    ...(visitor.friends || []).map(f => ({ id: f.id, firstName: f.firstName, lastName: f.lastName, selectedEntryIds: f.selectedEntryIds, times: null })),
  ], [visitor])

  useEffect(() => {
    if (!exportOptions.some(o => o.id === exportTarget)) setExportTarget('me')
  }, [exportOptions, exportTarget])

  const myEntries = useMemo(() => entriesForIds(entries, visitor.selectedEntryIds), [entries, visitor.selectedEntryIds])

  const horseNames = useMemo(() => {
    const seen = new Set()
    const names = []
    for (const e of myEntries) {
      if (e.horse_name && !seen.has(e.horse_name)) { seen.add(e.horse_name); names.push(e.horse_name) }
    }
    return names
  }, [myEntries])

  const [selectedHorse, setSelectedHorse] = useState('all')

  // The horse list is derived from the current selection — if it changes
  // (Edit) and the previously-picked horse no longer exists, fall back to
  // "All" instead of silently showing an empty view.
  useEffect(() => {
    if (selectedHorse !== 'all' && !horseNames.includes(selectedHorse)) setSelectedHorse('all')
  }, [horseNames, selectedHorse])

  const visibleEntries = useMemo(
    () => (selectedHorse === 'all' ? myEntries : myEntries.filter(e => e.horse_name === selectedHorse)),
    [myEntries, selectedHorse]
  )

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-14">
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <p className="text-white font-bold text-lg leading-tight">
            {visitor.firstName} {visitor.lastName}
          </p>
          <p className="text-green-400 text-xs">Nationals dashboard</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onEditSelection}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-green-200 border border-white/20 hover:bg-white/20 hover:text-white transition"
          >
            Edit
          </button>
          <button
            onClick={onNotYou}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-green-200 border border-white/20 hover:bg-white/20 hover:text-white transition"
          >
            <RotateCcw size={12} />
            Not you?
          </button>
        </div>
      </div>

      {activeTab === 'times' && (
        <HorseTabs horses={horseNames} active={selectedHorse} onChange={setSelectedHorse} />
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <SideNav
          active={activeTab}
          onChange={setActiveTab}
          mobileOpen={mobileNavOpen}
          onMobileOpen={() => setMobileNavOpen(true)}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <div className="flex-1 min-w-0">
          {activeTab === 'schedule' && (
            <ScheduleTable
              entries={myEntries}
              timesById={visitor.times}
              onTimeChange={onTimeChange}
              emptyText="No entries selected yet."
            />
          )}
          {activeTab === 'live' && (
            <LiveDayView myEntries={myEntries} visitor={visitor} onTimeChange={onTimeChange} />
          )}
          {activeTab === 'friends' && (
            <FriendsView
              entries={entries}
              friends={visitor.friends || []}
              onAddFriend={onAddFriend}
              onRemoveFriend={onRemoveFriend}
            />
          )}
          {activeTab === 'times' && (
            <TimesView myEntries={visibleEntries} visitor={visitor} />
          )}
          {activeTab === 'leveltarget' && (
            <LevelTargetView
              visitor={visitor}
              onTargetLevelChange={onTargetLevelChange}
              onLevelTimeChange={onLevelTimeChange}
            />
          )}
          {activeTab === 'export' && (
            <ExportView
              options={exportOptions}
              target={exportTarget}
              onTargetChange={setExportTarget}
              onDownload={handleExportPdf}
            />
          )}
          {activeTab === 'ridercard' && (
            <RiderCardView visitor={visitor} myEntries={myEntries} onPhotoChange={onPhotoChange} />
          )}
        </div>
      </div>

      <PrintExportArea
        target={exportOptions.find(o => o.id === exportTarget)}
        entries={entries}
        event={event}
      />

      <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
        <p className="text-green-300 text-sm min-w-0">Questions about rules, levels, or nationals eligibility?</p>
        <Link
          to="/klippies"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-green-500 hover:bg-green-400 text-white transition flex-shrink-0"
        >
          <Sparkles size={13} />
          Ask Klippies
        </Link>
      </div>
    </div>
  )
}

export default function Nationals() {
  const [entries, setEntries] = useState([])
  const [entriesLoaded, setEntriesLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [event, setEvent] = useState(null)

  const [visitor, setVisitor] = useState(() => loadVisitor())
  const [step, setStep] = useState(() => {
    const saved = loadVisitor()
    return saved?.selectedEntryIds?.length ? 'program' : 'verify'
  })
  const [activeTab, setActiveTab] = useState('schedule')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [searchError, setSearchError] = useState('')
  const [candidateEntries, setCandidateEntries] = useState([])
  const [checkedIds, setCheckedIds] = useState(new Set())

  useEffect(() => {
    let cancelled = false

    fetchNationalsEntries()
      .then(rows => { if (!cancelled) { setEntries(rows); setEntriesLoaded(true) } })
      .catch(() => { if (!cancelled) { setLoadError('Could not load the running order. Please try again shortly.'); setEntriesLoaded(true) } })

    async function loadEvent() {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('qualifier_events')
        .select('id, date, venue, province')
        .eq('event_type', 'nationals')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!cancelled && data) setEvent(data)
    }
    loadEvent()

    return () => { cancelled = true }
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    setSearchError('')
    if (!firstName.trim() || !lastName.trim()) {
      setSearchError('Please enter both your first name and surname.')
      return
    }
    const matches = findEntriesForName(entries, firstName.trim(), lastName.trim())
    if (!matches.length) {
      setSearchError(
        "We couldn't find that name in the published running order. Double-check the spelling, or contact the organisers if you believe this is a mistake."
      )
      setStep('notfound')
      return
    }
    setCandidateEntries(matches)
    setCheckedIds(new Set(matches.map(m => m.id)))
    setStep('select')
  }

  function toggleEntry(id) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function confirmSelection() {
    if (!checkedIds.size) return
    setVisitor(prev => {
      // Preserve any times/friends already saved — Edit re-runs this same
      // path, and it shouldn't wipe out times logged before the edit.
      const next = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        selectedEntryIds: Array.from(checkedIds),
        times: prev?.times || {},
        friends: prev?.friends || [],
      }
      saveVisitor(next)
      return next
    })
    setStep('program')
    setActiveTab('schedule')
  }

  function handleEditSelection() {
    setFirstName(visitor?.firstName || '')
    setLastName(visitor?.lastName || '')
    const matches = findEntriesForName(entries, visitor?.firstName || '', visitor?.lastName || '')
    setCandidateEntries(matches)
    setCheckedIds(new Set(visitor?.selectedEntryIds || []))
    setStep('select')
  }

  function handleNotYou() {
    clearVisitor()
    setVisitor(null)
    setFirstName('')
    setLastName('')
    setSearchError('')
    setCandidateEntries([])
    setCheckedIds(new Set())
    setActiveTab('schedule')
    setStep('verify')
  }

  function handleRunTimesChange(entryId, game, run1, run2) {
    const { best, level } = computeBestLevel(game, run1, run2)
    setVisitor(prev => {
      const next = {
        ...prev,
        times: { ...(prev?.times || {}), [entryId]: { run1, run2, best, level } },
      }
      saveVisitor(next)
      return next
    })
  }

  function handleAddFriend(friend) {
    setVisitor(prev => {
      const next = { ...prev, friends: [...(prev?.friends || []), friend] }
      saveVisitor(next)
      return next
    })
  }

  function handleRemoveFriend(id) {
    setVisitor(prev => {
      const next = { ...prev, friends: (prev?.friends || []).filter(f => f.id !== id) }
      saveVisitor(next)
      return next
    })
  }

  function handleTargetLevelChange(level) {
    setVisitor(prev => {
      const next = { ...prev, targetLevel: level }
      saveVisitor(next)
      return next
    })
  }

  function handleLevelTimeChange(game, run1, run2) {
    const { best, level } = computeBestLevel(game, run1, run2)
    setVisitor(prev => {
      const next = {
        ...prev,
        levelCheckTimes: { ...(prev?.levelCheckTimes || {}), [game]: { run1, run2, best, level } },
      }
      saveVisitor(next)
      return next
    })
  }

  function handleRiderCardPhotoChange(horseName, dataUrl) {
    setVisitor(prev => {
      const nextPhotos = { ...(prev?.riderCardPhotos || {}) }
      if (dataUrl) nextPhotos[horseName] = dataUrl
      else delete nextPhotos[horseName]
      const next = { ...prev, riderCardPhotos: nextPhotos }
      saveVisitor(next)
      return next
    })
  }

  const groups = useMemo(() => groupByHorse(candidateEntries), [candidateEntries])

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-950 via-green-950 to-green-900 flex flex-col">
      <PageHeader event={event} />

      {!entriesLoaded && <DashboardSkeleton />}

      {entriesLoaded && loadError && (
        <div className="w-full max-w-sm mx-auto px-4 pb-4 text-center">
          <p className="text-red-300 text-sm">{loadError}</p>
        </div>
      )}

      {entriesLoaded && step === 'verify' && (
        <VerifyStep
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
          onSubmit={handleSearch}
          error={searchError}
          submitting={false}
        />
      )}

      {entriesLoaded && step === 'notfound' && (
        <NotFoundStep error={searchError} onRetry={() => setStep('verify')} />
      )}

      {entriesLoaded && step === 'select' && (
        <SelectStep
          groups={groups}
          checkedIds={checkedIds}
          onToggle={toggleEntry}
          onConfirm={confirmSelection}
          onBack={() => setStep('verify')}
        />
      )}

      {entriesLoaded && step === 'program' && visitor && (
        <Dashboard
          visitor={visitor}
          entries={entries}
          event={event}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onEditSelection={handleEditSelection}
          onNotYou={handleNotYou}
          onTimeChange={handleRunTimesChange}
          onAddFriend={handleAddFriend}
          onRemoveFriend={handleRemoveFriend}
          onTargetLevelChange={handleTargetLevelChange}
          onLevelTimeChange={handleLevelTimeChange}
          onPhotoChange={handleRiderCardPhotoChange}
        />
      )}

      <div className="border-t border-green-800/60 bg-green-950/80 px-4 py-4 text-center mt-auto">
        <p className="text-green-400 text-xs">
          Powered by KlipKlop ·{' '}
          <Link to="/klippies" className="text-white font-semibold hover:underline">
            Ask Klippies about the rules →
          </Link>
        </p>
      </div>
    </div>
  )
}
