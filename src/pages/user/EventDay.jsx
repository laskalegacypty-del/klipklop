import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { QUALIFIER_GAMES, normalizeGameName } from '../../lib/constants'
import { getLevel } from '../../lib/matrix'
import { extractPagesFromPDFWithCoords } from '../../lib/pdfExtract'
import {
  parseRunningList,
  findMatchingCombo,
  entryKey,
  normalizeForMatch,
  stripDayAnnotation,
} from '../../lib/runningListParser'
import { Button, Card, CardContent, Modal, PageHeader, Skeleton } from '../../components/ui'
import {
  Upload,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Search,
  Trophy,
  ClipboardList,
  Save,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CURRENT_YEAR = new Date().getFullYear()

const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
}

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

export default function EventDay() {
  const { profile, isClubHead } = useAuth()

  const [step, setStep] = useState(1)
  const [events, setEvents] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [primaryEvent, setPrimaryEvent] = useState(null)
  const [isBackToBack, setIsBackToBack] = useState(false)
  const [secondaryEvent, setSecondaryEvent] = useState(null)

  const [uploading, setUploading] = useState(false)
  const [entries, setEntries] = useState([])
  const [parseError, setParseError] = useState('')
  const fileInputRef = useRef(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())

  const [myCombos, setMyCombos] = useState([])
  const [enteredTimes, setEnteredTimes] = useState({})
  const [timeModalEntry, setTimeModalEntry] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveResults, setSaveResults] = useState(null) // { saved, pbs, unmatched }

  const activeEvents = useMemo(
    () => [primaryEvent, isBackToBack ? secondaryEvent : null].filter(Boolean),
    [primaryEvent, secondaryEvent, isBackToBack]
  )

  // ── Load events ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const yearStart = `${CURRENT_YEAR}-01-01`
      const yearEnd = `${CURRENT_YEAR}-12-31`
      const { data } = await supabase
        .from('qualifier_events')
        .select('*')
        .eq('event_type', 'qualifier')
        .gte('date', yearStart)
        .lte('date', yearEnd)
        .order('date', { ascending: false })
      setEvents(data || [])
      setLoadingEvents(false)
    }
    load()
  }, [])

  // ── Load user combos ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return
    async function loadCombos() {
      const { data } = await supabase
        .from('horse_rider_combos')
        .select('*')
        .eq('user_id', profile.id)
        .is('managed_rider_id', null)
        .eq('is_archived', false)
      setMyCombos(data || [])
    }
    loadCombos()
  }, [profile])

  // ── Restore session from localStorage ────────────────────────────────────
  useEffect(() => {
    if (!primaryEvent) return
    try {
      const stored = localStorage.getItem(`event-day:${primaryEvent.id}`)
      if (!stored) return
      const { entries: e, selectedIds: ids, enteredTimes: et, isBackToBack: btb, secondaryEventId } = JSON.parse(stored)
      if (e?.length) {
        setEntries(e)
        setSelectedIds(new Set(ids || []))
        setEnteredTimes(et || {})
        if (btb) {
          setIsBackToBack(true)
          if (secondaryEventId) {
            const sec = events.find(ev => ev.id === secondaryEventId)
            if (sec) setSecondaryEvent(sec)
          }
        }
        setStep(4)
        toast.success('Restored your saved session')
      }
    } catch { /* ignore */ }
  }, [primaryEvent, events])

  // ── Persist session to localStorage ──────────────────────────────────────
  useEffect(() => {
    if (!primaryEvent || !entries.length) return
    try {
      localStorage.setItem(`event-day:${primaryEvent.id}`, JSON.stringify({
        entries,
        selectedIds: [...selectedIds],
        enteredTimes,
        isBackToBack,
        secondaryEventId: secondaryEvent?.id || null,
      }))
    } catch { /* ignore */ }
  }, [entries, selectedIds, enteredTimes, primaryEvent, isBackToBack, secondaryEvent])

  // ── Auto-select own horses after parsing ─────────────────────────────────
  function autoSelectOwnHorses(parsed) {
    const autoSelected = new Set()
    parsed.forEach(entry => {
      const match = findMatchingCombo(entry, myCombos)
      if (match) autoSelected.add(entryKey(entry))
    })
    return autoSelected
  }

  // ── PDF upload & parse ───────────────────────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    setParseError('')
    setUploading(true)
    const toastId = toast.loading('Parsing running list…')

    try {
      const coordPages = await extractPagesFromPDFWithCoords(file)
      const parsed = parseRunningList(coordPages)

      if (!parsed.length) {
        setParseError('No entries found. Make sure this is a running list PDF (not a scorecard).')
        toast.dismiss(toastId)
        toast.error('Could not parse the running list')
        return
      }

      setEntries(parsed)
      const autoSelected = autoSelectOwnHorses(parsed)
      setSelectedIds(autoSelected)
      setEnteredTimes({})
      toast.dismiss(toastId)
      toast.success(`Found ${parsed.length} entries across ${Math.max(...parsed.map(e => e.group))} group${parsed.length > 1 ? 's' : ''}`)
    } catch (err) {
      toast.dismiss(toastId)
      toast.error('Error reading PDF')
      console.error(err)
      setParseError('Could not read the PDF. Try a different file.')
    } finally {
      setUploading(false)
    }
  }

  // ── Entry selection helpers ───────────────────────────────────────────────
  function toggleEntry(entry) {
    const key = entryKey(entry)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries
    const q = normalizeForMatch(searchQuery)
    return entries.filter(e =>
      normalizeForMatch(e.riderName).includes(q) ||
      normalizeForMatch(e.horseName).includes(q) ||
      normalizeForMatch(e.club).includes(q)
    )
  }, [entries, searchQuery])

  const groupedFiltered = useMemo(() => {
    const groups = {}
    for (const entry of filteredEntries) {
      if (!groups[entry.group]) groups[entry.group] = []
      groups[entry.group].push(entry)
    }
    return groups
  }, [filteredEntries])

  const selectedEntries = useMemo(
    () => entries.filter(e => selectedIds.has(entryKey(e))),
    [entries, selectedIds]
  )

  // ── Time entry helpers ───────────────────────────────────────────────────
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

  function getLiveLevel(entry, event, game) {
    const g = getGameEntry(entry, event, game)
    if (g.is_nt || !g.time) return null
    const t = parseFloat(g.time)
    if (isNaN(t)) return null
    return getLevel(game, t)
  }

  // ── Save all ─────────────────────────────────────────────────────────────
  async function handleSaveAll() {
    if (!selectedEntries.length) return
    setSaving(true)
    setSaveResults(null)
    let totalSaved = 0
    let totalPBs = 0
    const unmatched = []

    try {
      for (const entry of selectedEntries) {
        const key = entryKey(entry)
        const timesForEntry = enteredTimes[key]

        // Check if there's anything to save
        const hasAnyTime = activeEvents.some(event => {
          const games = QUALIFIER_GAMES[event.qualifier_number] || []
          return games.some(game => {
            const g = timesForEntry?.[event.id]?.[game]
            return g && (g.is_nt || (g.time && g.time.trim() !== ''))
          })
        })

        if (!hasAnyTime) continue

        const combo = findMatchingCombo(entry, myCombos)
        if (!combo) {
          unmatched.push(entry)
          continue
        }

        for (const event of activeEvents) {
          const games = QUALIFIER_GAMES[event.qualifier_number] || []
          const eventTimes = timesForEntry?.[event.id] || {}
          const resultsToInsert = []
          const eventYear = new Date(event.date).getFullYear()
          const achievedAt = `${event.date}T00:00:00.000Z`

          for (const game of games) {
            const g = eventTimes[game]
            if (!g) continue
            const hasValue = g.is_nt || (g.time && g.time.trim() !== '')
            if (!hasValue) continue

            const finalTime = g.is_nt ? null : (parseFloat(g.time) || null)
            const normalizedGame = normalizeGameName(game)

            resultsToInsert.push({
              combo_id: combo.id,
              event_id: event.id,
              game: normalizedGame,
              time: finalTime,
              is_nt: g.is_nt || false,
              level_entered: entry.level,
              level_achieved: finalTime !== null ? getLevel(normalizedGame, finalTime) : null,
              penalties: 0,
            })
          }

          if (!resultsToInsert.length) continue

          // Delete existing results for this combo+event before inserting
          const { data: existing } = await supabase
            .from('qualifier_results')
            .select('id')
            .eq('combo_id', combo.id)
            .eq('event_id', event.id)

          if (existing?.length) {
            await supabase.from('qualifier_results').delete().in('id', existing.map(r => r.id))
          }

          const { error: insertError } = await supabase
            .from('qualifier_results')
            .insert(resultsToInsert)

          if (insertError) throw insertError

          totalSaved += resultsToInsert.length

          // Update personal bests
          for (const result of resultsToInsert) {
            if (result.time === null) continue

            const { data: existingPB } = await supabase
              .from('personal_bests')
              .select('best_time')
              .eq('combo_id', combo.id)
              .eq('game', result.game)
              .eq('season_year', eventYear)
              .maybeSingle()

            if (!existingPB || result.time < existingPB.best_time) {
              await supabase.from('personal_bests').upsert({
                combo_id: combo.id,
                game: result.game,
                best_time: result.time,
                season_year: eventYear,
                achieved_at: achievedAt,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'combo_id,game,season_year', ignoreDuplicates: false })
              totalPBs++
            }
          }
        }
      }

      setSaveResults({ saved: totalSaved, pbs: totalPBs, unmatched })
      if (totalSaved > 0) {
        // Clear localStorage for this session
        if (primaryEvent) localStorage.removeItem(`event-day:${primaryEvent.id}`)
        toast.success(`Saved ${totalSaved} results${totalPBs > 0 ? ` · ${totalPBs} new PB${totalPBs > 1 ? 's' : ''}` : ''}!`)
      } else {
        toast('No new times to save — enter times first.', { icon: 'ℹ️' })
      }
    } catch (err) {
      toast.error('Error saving times')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  function eventLabel(event) {
    if (!event) return '—'
    return `Q${event.qualifier_number} · ${event.venue} · ${new Date(event.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-2xl mx-auto px-4 pb-32">
      <PageHeader
        title="Event Day"
        description="Upload the running list, track your riders, and save times as the day goes by."
        icon={ClipboardList}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {['Setup', 'Running List', 'Select Riders', 'Track & Save'].map((label, i) => {
          const num = i + 1
          const active = step === num
          const done = step > num
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${active ? 'text-green-700' : done ? 'text-green-500' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-green-700 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {done ? <Check size={12} /> : num}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${active ? 'text-green-700' : done ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
              </div>
              {i < 3 && <div className={`h-px flex-1 min-w-[12px] ${step > num ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          )
        })}
      </div>

      {/* ── STEP 1: SETUP ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardContent className="space-y-5 py-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Qualifier</label>
              {loadingEvents ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <select
                  className="w-full h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={primaryEvent?.id || ''}
                  onChange={e => {
                    const ev = events.find(x => x.id === e.target.value) || null
                    setPrimaryEvent(ev)
                    setSecondaryEvent(null)
                  }}
                >
                  <option value="">— Choose a qualifier —</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{eventLabel(ev)}</option>
                  ))}
                </select>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setIsBackToBack(v => !v)}
                className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isBackToBack ? 'bg-green-600' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${isBackToBack ? 'translate-x-5.5 ml-0.5' : 'ml-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Back-to-back weekend (two qualifiers, same running list)</span>
            </label>

            {isBackToBack && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Second Qualifier</label>
                <select
                  className="w-full h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={secondaryEvent?.id || ''}
                  onChange={e => {
                    const ev = events.find(x => x.id === e.target.value) || null
                    setSecondaryEvent(ev)
                  }}
                >
                  <option value="">— Choose second qualifier —</option>
                  {events.filter(ev => ev.id !== primaryEvent?.id).map(ev => (
                    <option key={ev.id} value={ev.id}>{eventLabel(ev)}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button
                disabled={!primaryEvent || (isBackToBack && !secondaryEvent)}
                onClick={() => setStep(2)}
                className="flex items-center gap-2"
              >
                Next <ChevronRight size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: UPLOAD RUNNING LIST ───────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardContent className="space-y-5 py-6">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Selected Qualifier{activeEvents.length > 1 ? 's' : ''}</p>
              {activeEvents.map(ev => (
                <p key={ev.id} className="text-sm text-green-700 font-medium">{eventLabel(ev)}</p>
              ))}
            </div>

            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-400 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={32} className="mx-auto mb-3 text-gray-400" />
              <p className="text-sm font-semibold text-gray-700">Upload Running List PDF</p>
              <p className="text-xs text-gray-400 mt-1">Tap to choose or drop the running list file</p>
              {uploading && <p className="text-xs text-green-600 mt-2 font-medium animate-pulse">Parsing…</p>}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileUpload}
            />

            {parseError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{parseError}</div>
            )}

            {entries.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-800 font-semibold text-sm">
                  <Check size={16} className="text-green-600" />
                  {entries.length} entries found across {Math.max(...entries.map(e => e.group))} group{entries.length > 1 ? 's' : ''}
                </div>
                <p className="text-xs text-green-600 mt-1">
                  {selectedIds.size} of your horse{selectedIds.size !== 1 ? 's' : ''} auto-selected
                </p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)} className="flex items-center gap-2">
                <ChevronLeft size={16} /> Back
              </Button>
              <Button
                disabled={!entries.length}
                onClick={() => setStep(3)}
                className="flex items-center gap-2"
              >
                Next <ChevronRight size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 3: SELECT RIDERS ─────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Search + bulk actions */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search rider or horse…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={() => setSelectedIds(new Set(entries.map(entryKey)))}
              className="px-3 text-xs font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50"
            >
              All
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 text-xs font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              None
            </button>
          </div>

          <p className="text-xs text-gray-500 px-1">{selectedIds.size} of {entries.length} selected</p>

          {/* Groups */}
          {Object.entries(groupedFiltered).sort(([a], [b]) => Number(a) - Number(b)).map(([group, groupEntries]) => (
            <div key={group}>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">Group {group}</div>
              <div className="space-y-1">
                {groupEntries.map(entry => {
                  const key = entryKey(entry)
                  const checked = selectedIds.has(key)
                  const isMyHorse = !!findMatchingCombo(entry, myCombos)
                  return (
                    <div
                      key={key}
                      onClick={() => toggleEntry(entry)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl border cursor-pointer transition ${checked ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${checked ? 'border-green-600 bg-green-600' : 'border-gray-300'}`}>
                        {checked && <Check size={12} className="text-white" />}
                      </div>
                      <div className="w-8 text-center text-xs font-bold text-gray-500 flex-shrink-0">#{entry.runNumber}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800 truncate">{stripDayAnnotation(entry.riderName)}</span>
                          {isMyHorse && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">My horse</span>}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{entry.horseName}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[entry.category] || 'bg-gray-100 text-gray-600'}`}>
                          {entry.category}{entry.level}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(2)} className="flex items-center gap-2">
              <ChevronLeft size={16} /> Back
            </Button>
            <Button
              disabled={!selectedIds.size}
              onClick={() => setStep(4)}
              className="flex items-center gap-2"
            >
              Track {selectedIds.size} rider{selectedIds.size !== 1 ? 's' : ''} <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: DAY TRACKER ───────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Event header */}
          <div className="bg-green-800 text-white rounded-xl px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-xs font-semibold uppercase tracking-wide">Today's Event{activeEvents.length > 1 ? 's' : ''}</p>
                {activeEvents.map(ev => (
                  <p key={ev.id} className="font-bold text-sm">{eventLabel(ev)}</p>
                ))}
              </div>
              <div className="text-right">
                <p className="text-green-200 text-xs">{selectedEntries.length} riders tracked</p>
                <p className="text-green-200 text-xs">
                  {selectedEntries.filter(e => entryStatus(e, enteredTimes, activeEvents) === 'complete').length} complete
                </p>
              </div>
            </div>
          </div>

          {/* Save results banner */}
          {saveResults && (
            <div className={`rounded-xl border p-4 text-sm ${saveResults.saved > 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
              {saveResults.saved > 0 ? (
                <>
                  <div className="font-semibold">✓ Saved {saveResults.saved} results{saveResults.pbs > 0 ? ` · ${saveResults.pbs} new PB${saveResults.pbs > 1 ? 's' : ''}` : ''}</div>
                  {saveResults.unmatched.length > 0 && (
                    <div className="mt-1 text-xs text-amber-700">
                      {saveResults.unmatched.length} entr{saveResults.unmatched.length > 1 ? 'ies' : 'y'} skipped — no matching horse combo in your profile:
                      {' '}{saveResults.unmatched.map(e => e.horseName).join(', ')}
                    </div>
                  )}
                </>
              ) : (
                <div>No times saved yet. Enter times below, then tap Save All.</div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 px-1 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><StatusDot status="empty" /> No times</div>
            <div className="flex items-center gap-1.5"><StatusDot status="partial" /> Partial</div>
            <div className="flex items-center gap-1.5"><StatusDot status="complete" /> Complete</div>
          </div>

          {/* Entry cards */}
          {selectedEntries.map(entry => {
            const status = entryStatus(entry, enteredTimes, activeEvents)
            return (
              <div
                key={entryKey(entry)}
                className={`bg-white border rounded-xl overflow-hidden ${status === 'complete' ? 'border-green-300' : status === 'partial' ? 'border-yellow-300' : 'border-gray-200'}`}
              >
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
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
                      onClick={() => setTimeModalEntry(entry)}
                      className="text-xs font-semibold text-white bg-green-700 hover:bg-green-800 px-3 py-2 rounded-lg transition"
                    >
                      Enter Times
                    </button>
                  </div>
                </div>

                {/* Inline time preview */}
                {status !== 'empty' && (
                  <div className="border-t border-gray-100 px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
                    {activeEvents.map(event => {
                      const games = QUALIFIER_GAMES[event.qualifier_number] || []
                      return games.map(game => {
                        const g = getGameEntry(entry, event, game)
                        const filled = g.is_nt || (g.time && g.time.trim() !== '')
                        if (!filled) return null
                        const level = getLiveLevel(entry, event, game)
                        return (
                          <div key={`${event.id}-${game}`} className="flex items-center gap-1.5 text-xs">
                            <span className="text-gray-500">{game}:</span>
                            {g.is_nt
                              ? <span className="text-red-600 font-medium">NT</span>
                              : <span className="font-semibold text-gray-800">{parseFloat(g.time).toFixed(3)}s</span>
                            }
                            {level !== null && !g.is_nt && (
                              <span className={`text-[10px] px-1 rounded ${LEVEL_STYLES[level]}`}>L{level}</span>
                            )}
                          </div>
                        )
                      })
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Add more riders button */}
          <button
            onClick={() => setStep(3)}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition flex items-center justify-center gap-2"
          >
            <Users size={16} /> Add / remove riders
          </button>
        </div>
      )}

      {/* ── FLOATING SAVE BUTTON (step 4) ─────────────────────────────────── */}
      {step === 4 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-gray-200 z-40">
          <div className="max-w-2xl mx-auto flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3"
            >
              <ChevronLeft size={16} /> Start over
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? 'Saving…' : 'Save All Times'}
            </button>
          </div>
        </div>
      )}

      {/* ── TIME ENTRY MODAL ─────────────────────────────────────────────── */}
      <Modal
        open={!!timeModalEntry}
        onClose={() => setTimeModalEntry(null)}
        title={timeModalEntry ? `#${timeModalEntry.runNumber} · ${timeModalEntry.horseName}` : ''}
        size="lg"
      >
        {timeModalEntry && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto -mx-2 px-2">
            {activeEvents.map(event => {
              const games = QUALIFIER_GAMES[event.qualifier_number] || []
              return (
                <div key={event.id}>
                  <div className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3">
                    Q{event.qualifier_number} — {event.venue}
                  </div>
                  <div className="space-y-2">
                    {games.map(game => {
                      const g = getGameEntry(timeModalEntry, event, game)
                      const level = getLiveLevel(timeModalEntry, event, game)
                      return (
                        <div key={game} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                          <div className="w-32 text-sm text-gray-700 font-medium flex-shrink-0">{game}</div>
                          <div className="flex-1">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              placeholder="00.000"
                              disabled={g.is_nt}
                              value={g.time}
                              onChange={e => setGameEntry(timeModalEntry, event, game, { time: e.target.value })}
                              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
                            />
                          </div>
                          <button
                            onClick={() => setGameEntry(timeModalEntry, event, game, { is_nt: !g.is_nt, time: g.is_nt ? '' : g.time })}
                            className={`px-3 h-10 rounded-lg text-xs font-bold border transition flex-shrink-0 ${g.is_nt ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-600'}`}
                          >
                            NT
                          </button>
                          {level !== null && (
                            <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${LEVEL_STYLES[level]}`}>
                              L{level}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div className="pt-2">
              <Button
                onClick={() => setTimeModalEntry(null)}
                className="w-full"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
