import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { QUALIFIER_GAMES, normalizeGameName } from '../../lib/constants'
import { getLevel } from '../../lib/matrix'
import { extractPagesFromPDFWithCoords } from '../../lib/pdfExtract'
import { fetchClubHeadRoster, fetchCombosForRider } from '../../lib/clubRiderRoster'
import {
  parseRunningList,
  findMatchingCombo,
  entryKey,
  normalizeForMatch,
  stripDayAnnotation,
} from '../../lib/runningListParser'
import {
  ACTIVE_SESSION_KEY,
  createEventDaySession,
  fetchHelperContributions,
  fetchMyActiveEventDaySession,
  revokeEventDaySession,
  mergeHelperContributions,
  syncHelperTimes,
} from '../../lib/eventDayShare'
import { copyAndShare } from '../../lib/shareLink'
import EventDayTimeModal from '../../components/event-day/EventDayTimeModal'
import EventDayHistory from './EventDayHistory'
import { Button, Card, CardContent, PageHeader, Skeleton } from '../../components/ui'
import {
  Upload,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  X,
  ClipboardList,
  Save,
  Users,
  Link2,
  RefreshCw,
  Download,
  Trash2,
  List,
  History,
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

function findEntriesInList(entries, query) {
  const q = normalizeForMatch(query)
  if (!q) return []
  const raw = query.trim()
  return entries.filter(e =>
    normalizeForMatch(stripDayAnnotation(e.riderName)).includes(q) ||
    normalizeForMatch(e.horseName).includes(q) ||
    String(e.runNumber).includes(raw)
  )
}

function EntryInfoCard({ entry, showClub = true }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-800">{stripDayAnnotation(entry.riderName)}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[entry.category] || 'bg-gray-100 text-gray-600'}`}>
          {entry.category}{entry.level}
        </span>
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{entry.horseName}</div>
      <div className="text-xs text-gray-400 mt-0.5">
        Run #{entry.runNumber} · Group {entry.group}
        {showClub && entry.club ? ` · ${entry.club}` : ''}
      </div>
    </div>
  )
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
  const navigate = useNavigate()

  // Check localStorage synchronously so we can show "resuming" before events load
  const [resumeDraft] = useState(() => {
    try {
      const raw = localStorage.getItem('event-day:session')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.entries?.length ? parsed : null
    } catch { return null }
  })

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
  const [dragOver, setDragOver] = useState(false)

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [matchedIds, setMatchedIds] = useState(new Set())
  const [nameSearch, setNameSearch] = useState('')
  const [searchTerms, setSearchTerms] = useState([])

  const [myCombos, setMyCombos] = useState([])
  const [loadingCombos, setLoadingCombos] = useState(true)
  const [entryPBs, setEntryPBs] = useState({})
  const [enteredTimes, setEnteredTimes] = useState({})
  const [timeModalEntry, setTimeModalEntry] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveResults, setSaveResults] = useState(null)
  const [activeMainTab, setActiveMainTab] = useState('event')

  const [helperSessionUrl, setHelperSessionUrl] = useState(null)
  const [helperSessionToken, setHelperSessionToken] = useState(null)
  const [creatingHelperLink, setCreatingHelperLink] = useState(false)
  const [helperContributions, setHelperContributions] = useState([])
  const [loadingContributions, setLoadingContributions] = useState(false)

  const [showRunningList, setShowRunningList] = useState(false)
  const [runningListSearch, setRunningListSearch] = useState('')

  const restoredRef = useRef(false)

  const activeEvents = useMemo(
    () => [primaryEvent, isBackToBack ? secondaryEvent : null].filter(Boolean),
    [primaryEvent, secondaryEvent, isBackToBack]
  )

  const matchedEntries = useMemo(
    () => entries.filter(e => matchedIds.has(entryKey(e))),
    [entries, matchedIds]
  )

  const profileMatchCount = useMemo(() => {
    if (!myCombos.length) return 0
    return matchedEntries.filter(e => findMatchingCombo(e, myCombos)).length
  }, [matchedEntries, myCombos])

  // ── Load events ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const yearStart = `${CURRENT_YEAR}-01-01`
      const yearEnd = `${CURRENT_YEAR}-12-31`
      const { data, error } = await supabase
        .from('qualifier_events')
        .select('*')
        .eq('event_type', 'qualifier')
        .gte('date', yearStart)
        .lte('date', yearEnd)
        .order('date', { ascending: false })

      if (error) {
        toast.error('Could not load qualifier events')
        console.error(error)
      }
      setEvents(data || [])
      setLoadingEvents(false)
    }
    load()
  }, [])

  // ── Bootstrap active session on mount ────────────────────────────────────
  useEffect(() => {
    if (!events.length || restoredRef.current) return

    let restoredLocally = false

    try {
      const draft = localStorage.getItem('event-day:session')
      if (draft) {
        const parsed = JSON.parse(draft)
        const { entries: e, matchedIds: mids, selectedIds: ids, enteredTimes: et, isBackToBack: btb, primaryEventId, secondaryEventId, step: savedStep, helperSessionToken: hst, helperSessionUrl: hsu } = parsed
        if (e?.length) {
          restoredRef.current = true
          restoredLocally = true
          setEntries(e)
          setMatchedIds(new Set(mids || []))
          setSelectedIds(new Set(ids || []))
          setEnteredTimes(et || {})
          if (hst) setHelperSessionToken(hst)
          if (hsu) setHelperSessionUrl(hsu)
          if (btb) setIsBackToBack(true)
          if (primaryEventId) {
            const ev = events.find(x => x.id === primaryEventId)
            if (ev) setPrimaryEvent(ev)
          }
          if (secondaryEventId) {
            const sec = events.find(x => x.id === secondaryEventId)
            if (sec) setSecondaryEvent(sec)
          }
          if (savedStep) setStep(savedStep)
          toast.success('Restored your saved session')
        }
      }

      if (!restoredLocally) {
        const active = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY))
        if (active?.primaryEventId && !primaryEvent) {
          const ev = events.find(e => e.id === active.primaryEventId)
          if (ev) { setPrimaryEvent(ev); restoredLocally = true }
        }
      }
    } catch { /* ignore */ }

    if (restoredLocally) return

    // No local session — try DB (handles new device / phone)
    async function tryRestoreFromDB() {
      if (restoredRef.current) return
      try {
        const dbSession = await fetchMyActiveEventDaySession()
        if (!dbSession || restoredRef.current) return

        const ev = events.find(e => e.id === dbSession.primary_event_id)
        if (!ev) return

        restoredRef.current = true
        const sessionEntries = dbSession.entries || []
        const selectedKeys = dbSession.selected_entry_keys || []

        setEntries(sessionEntries)
        setSelectedIds(new Set(selectedKeys))
        setMatchedIds(new Set())
        setHelperSessionToken(dbSession.token)
        setIsBackToBack(dbSession.is_back_to_back || false)
        setPrimaryEvent(ev)

        if (dbSession.secondary_event_id) {
          const sec = events.find(e => e.id === dbSession.secondary_event_id)
          if (sec) setSecondaryEvent(sec)
        }

        // Merge all contributions (includes organizer's own synced times)
        const { contributions } = await fetchHelperContributions(dbSession.token)
        if (contributions.length) {
          setEnteredTimes(prev => mergeHelperContributions(prev, contributions))
        }

        setStep(5)
        toast.success('Restored your session')
      } catch (err) {
        console.error('DB session restore failed', err)
      }
    }

    tryRestoreFromDB()
  }, [events, primaryEvent])

  // ── Load user combos ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    async function loadCombos() {
      setLoadingCombos(true)
      try {
        if (isClubHead) {
          const roster = await fetchClubHeadRoster(profile.id)
          const allCombos = []
          for (const rider of roster) {
            const riderCombos = await fetchCombosForRider(rider)
            allCombos.push(...riderCombos)
          }
          const { data: ownCombos } = await supabase
            .from('horse_rider_combos')
            .select('*')
            .eq('user_id', profile.id)
            .is('managed_rider_id', null)
            .eq('is_archived', false)

          const byId = new Map()
          ;[...(ownCombos || []), ...allCombos].forEach(c => byId.set(c.id, c))
          if (!cancelled) setMyCombos([...byId.values()])
        } else {
          const { data } = await supabase
            .from('horse_rider_combos')
            .select('*')
            .eq('user_id', profile.id)
            .is('managed_rider_id', null)
            .eq('is_archived', false)
          if (!cancelled) setMyCombos(data || [])
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) setMyCombos([])
      } finally {
        if (!cancelled) setLoadingCombos(false)
      }
    }

    loadCombos()
    return () => { cancelled = true }
  }, [profile, isClubHead])

  // ── Fetch PBs for matched combos ──────────────────────────────────────────
  useEffect(() => {
    if (!myCombos.length || !entries.length) return
    let cancelled = false

    async function fetchPBs() {
      const comboMap = {}
      for (const e of entries) {
        const combo = findMatchingCombo(e, myCombos)
        if (combo) comboMap[entryKey(e)] = combo.id
      }
      const comboIds = [...new Set(Object.values(comboMap))]
      if (!comboIds.length) return

      const { data: pbRows } = await supabase
        .from('personal_bests')
        .select('combo_id, game, best_time')
        .in('combo_id', comboIds)

      if (cancelled) return

      const pbsByCombo = {}
      for (const row of pbRows || []) {
        if (!pbsByCombo[row.combo_id]) pbsByCombo[row.combo_id] = {}
        const existing = pbsByCombo[row.combo_id][row.game]
        if (existing == null || row.best_time < existing)
          pbsByCombo[row.combo_id][row.game] = row.best_time
      }

      const byEntry = {}
      for (const [ek, comboId] of Object.entries(comboMap))
        byEntry[ek] = pbsByCombo[comboId] || {}

      if (cancelled) return
      setEntryPBs(byEntry)

      // Patch any existing active helper session so PBs show on the helper link
      // without needing a revoke + recreate
      const token = helperSessionToken
      if (token && Object.keys(byEntry).length) {
        const enriched = entries.map(e => ({ ...e, pbs: byEntry[entryKey(e)] || {} }))
        supabase
          .from('event_day_sessions')
          .update({ entries: enriched })
          .eq('token', token)
          .then(({ error }) => error && console.error('Failed to patch session PBs', error))
      }
    }

    fetchPBs()
    return () => { cancelled = true }
  }, [myCombos, entries])

  // ── Restore session from localStorage (legacy per-event key) ─────────────
  useEffect(() => {
    if (!primaryEvent || restoredRef.current) return
    try {
      const stored = localStorage.getItem(`event-day:${primaryEvent.id}`)
      if (!stored) return
      const parsed = JSON.parse(stored)
      const { entries: e, selectedIds: ids, enteredTimes: et, isBackToBack: btb, secondaryEventId, helperSessionToken: hst, helperSessionUrl: hsu, matchedIds: mids } = parsed
      if (e?.length) {
        restoredRef.current = true
        setEntries(e)
        setMatchedIds(new Set(mids || ids || []))
        setSelectedIds(new Set(ids || []))
        setEnteredTimes(et || {})
        if (hst) setHelperSessionToken(hst)
        if (hsu) setHelperSessionUrl(hsu)
        if (btb) {
          setIsBackToBack(true)
          if (secondaryEventId) {
            const sec = events.find(ev => ev.id === secondaryEventId)
            if (sec) setSecondaryEvent(sec)
          }
        }
        setStep(5)
        toast.success('Restored your saved session')
      }
    } catch { /* ignore */ }
  }, [primaryEvent, events])

  // ── Persist session to localStorage ──────────────────────────────────────
  useEffect(() => {
    if (!entries.length) return
    try {
      const payload = {
        entries,
        matchedIds: [...matchedIds],
        selectedIds: [...selectedIds],
        enteredTimes,
        isBackToBack,
        primaryEventId: primaryEvent?.id || null,
        secondaryEventId: secondaryEvent?.id || null,
        step,
        helperSessionToken,
        helperSessionUrl,
      }
      localStorage.setItem('event-day:session', JSON.stringify(payload))
      if (primaryEvent) {
        localStorage.setItem(`event-day:${primaryEvent.id}`, JSON.stringify(payload))
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
          primaryEventId: primaryEvent.id,
          step,
        }))
      }
    } catch { /* ignore */ }
  }, [entries, matchedIds, selectedIds, enteredTimes, primaryEvent, isBackToBack, secondaryEvent, step, helperSessionToken, helperSessionUrl])

  // ── Sync organizer's entered times to DB for cross-device access ─────────
  const orgSyncTimerRef = useRef(null)
  useEffect(() => {
    if (!helperSessionToken || !primaryEvent || !entries.length) return
    if (orgSyncTimerRef.current) clearTimeout(orgSyncTimerRef.current)
    orgSyncTimerRef.current = setTimeout(async () => {
      const activeEvs = [primaryEvent, isBackToBack && secondaryEvent].filter(Boolean)
      const rows = []
      for (const [ek, byEvent] of Object.entries(enteredTimes)) {
        for (const ev of activeEvs) {
          const games = QUALIFIER_GAMES[ev.qualifier_number] || []
          const eventTimes = byEvent[ev.id] || {}
          for (const game of games) {
            const g = eventTimes[game]
            if (!g) continue
            if (g.is_nt) {
              rows.push({ entry_key: ek, event_id: ev.id, game, time: null, is_nt: true })
            } else if (g.time && String(g.time).trim() !== '') {
              rows.push({ entry_key: ek, event_id: ev.id, game, time: parseFloat(g.time), is_nt: false })
            }
          }
        }
      }
      if (!rows.length) return
      try {
        await syncHelperTimes(helperSessionToken, {
          times: rows,
          helperLabel: 'Organizer',
          deviceId: `organizer-${profile?.id || 'main'}`,
        })
      } catch (err) {
        console.error('Organizer sync failed', err)
      }
    }, 1200)
    return () => clearTimeout(orgSyncTimerRef.current)
  }, [enteredTimes, helperSessionToken, primaryEvent, secondaryEvent, isBackToBack, entries.length, profile])

  // ── PDF upload & parse ───────────────────────────────────────────────────
  async function processPdfFile(file) {
    if (!file || file.type !== 'application/pdf') {
      setParseError('Please upload a PDF file.')
      return
    }

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

      restoredRef.current = false
      setEntries(parsed)
      setEnteredTimes({})
      setSelectedIds(new Set())
      setMatchedIds(new Set())
      setSearchTerms([])
      setNameSearch('')

      toast.dismiss(toastId)
      toast.success(`Found ${parsed.length} entries across ${Math.max(...parsed.map(e => e.group))} group${parsed.length > 1 ? 's' : ''}`)
      setStep(2)
    } catch (err) {
      toast.dismiss(toastId)
      toast.error('Error reading PDF')
      console.error(err)
      setParseError('Could not read the PDF. Try a different file.')
    } finally {
      setUploading(false)
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    await processPdfFile(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  async function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) await processPdfFile(file)
  }

  function handleRemoveCombo(entry) {
    const key = entryKey(entry)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  function handleStartOver() {
    const eventId = primaryEvent?.id
    if (eventId) localStorage.removeItem(`event-day:${eventId}`)
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    localStorage.removeItem('event-day:session')

    setStep(1)
    setPrimaryEvent(null)
    setSecondaryEvent(null)
    setIsBackToBack(false)
    setEntries([])
    setSelectedIds(new Set())
    setMatchedIds(new Set())
    setSearchTerms([])
    setNameSearch('')
    setEnteredTimes({})
    setSaveResults(null)
    setParseError('')
    setNameSearch('')
    setHelperSessionUrl(null)
    setHelperSessionToken(null)
    setHelperContributions([])
    restoredRef.current = false
  }

  function handleDoneForNow() {
    toast.success('Session saved — come back anytime to resume')
    navigate('/dashboard')
  }

  function handleEndEvent() {
    if (!window.confirm('End this event? Your unsaved times will be lost.')) return
    handleStartOver()
  }

  function handleFindRider() {
    const term = nameSearch.trim()
    if (!term) return

    const matches = findEntriesInList(entries, term)
    if (!matches.length) {
      toast.error(`No entries found for "${term}"`)
      return
    }

    setMatchedIds(prev => {
      const next = new Set(prev)
      matches.forEach(e => next.add(entryKey(e)))
      return next
    })
    setSearchTerms(prev => [...prev, term])
    setNameSearch('')
    toast.success(`Found ${matches.length} match${matches.length !== 1 ? 'es' : ''} for "${term}"`)
  }

  function handleRemoveMatched(entry) {
    const key = entryKey(entry)
    setMatchedIds(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  function toggleSelectEntry(entry) {
    const key = entryKey(entry)
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedEntries = useMemo(
    () => entries.filter(e => selectedIds.has(entryKey(e))),
    [entries, selectedIds]
  )

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
          const eventYear = new Date(event.date).getFullYear()
          const achievedAt = `${event.date}T00:00:00.000Z`

          for (const game of games) {
            const g = eventTimes[game]
            if (!g) continue
            const hasValue = g.is_nt || (g.time && g.time.trim() !== '')
            if (!hasValue) continue

            const finalTime = g.is_nt ? null : (parseFloat(g.time) || null)
            const normalizedGame = normalizeGameName(game)
            const levelAchieved = finalTime !== null ? getLevel(normalizedGame, finalTime) : null

            const { error: upsertError } = await supabase
              .from('event_day_results')
              .upsert({
                combo_id: combo.id,
                event_id: event.id,
                game: normalizedGame,
                time: finalTime,
                is_nt: g.is_nt || false,
                level_entered: parseInt(entry.level) || 0,
                level_achieved: levelAchieved,
                run_number: entry.runNumber || null,
                rider_name: stripDayAnnotation(entry.riderName) || null,
                horse_name: entry.horseName || null,
              }, { onConflict: 'combo_id,event_id,game' })
            if (upsertError) throw upsertError

            totalSaved++

            if (finalTime !== null) {
              const { data: existingPB } = await supabase
                .from('personal_bests')
                .select('best_time')
                .eq('combo_id', combo.id)
                .eq('game', normalizedGame)
                .eq('season_year', eventYear)
                .maybeSingle()

              if (!existingPB || finalTime < existingPB.best_time) {
                const { error: pbError } = await supabase.from('personal_bests').upsert({
                  combo_id: combo.id,
                  game: normalizedGame,
                  best_time: finalTime,
                  season_year: eventYear,
                  achieved_at: achievedAt,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'combo_id,game,season_year', ignoreDuplicates: false })
                if (pbError) throw pbError
                totalPBs++
              }
            }
          }
        }
      }

      setSaveResults({ saved: totalSaved, pbs: totalPBs, unmatched })
      if (totalSaved > 0) {
        localStorage.removeItem('event-day:session')
        if (primaryEvent) localStorage.removeItem(`event-day:${primaryEvent.id}`)
        localStorage.removeItem(ACTIVE_SESSION_KEY)
        if (helperSessionToken) {
          try { await revokeEventDaySession(helperSessionToken) } catch { /* ignore */ }
          setHelperSessionToken(null)
          setHelperSessionUrl(null)
        }
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

  const refreshHelperContributions = useCallback(async () => {
    if (!helperSessionToken) return
    setLoadingContributions(true)
    try {
      const data = await fetchHelperContributions(helperSessionToken)
      setHelperContributions(data.contributions || [])
    } catch (err) {
      console.error(err)
      toast.error('Could not load helper times')
    } finally {
      setLoadingContributions(false)
    }
  }, [helperSessionToken])

  useEffect(() => {
    if (step === 5 && helperSessionToken) {
      refreshHelperContributions()
    }
  }, [step, helperSessionToken, refreshHelperContributions])

  async function handleCreateHelperLink() {
    if (!primaryEvent || !selectedEntries.length) return
    setCreatingHelperLink(true)
    try {
      // PBs are already fetched into entryPBs — just embed them
      const enrichedEntries = entries.map(entry => ({
        ...entry,
        pbs: entryPBs[entryKey(entry)] || {},
      }))

      const result = await createEventDaySession({
        created_by: profile?.id,
        primary_event_id: primaryEvent.id,
        secondary_event_id: secondaryEvent?.id || null,
        is_back_to_back: isBackToBack,
        entries: enrichedEntries,
        selected_entry_keys: [...selectedIds],
        venue: primaryEvent.venue,
      })

      setHelperSessionUrl(result.url)
      setHelperSessionToken(result.session?.token || null)

      await copyAndShare({
        url: result.url,
        shareMessage: result.share_message,
        shareTitle: result.share_title,
      })
      toast.success('Helper link copied — share with family or trainers')
    } catch (err) {
      toast.error(err.message || 'Could not create helper link')
    } finally {
      setCreatingHelperLink(false)
    }
  }

  async function handleRevokeHelperLink() {
    if (!helperSessionToken) return
    try {
      await revokeEventDaySession(helperSessionToken)
      setHelperSessionUrl(null)
      setHelperSessionToken(null)
      setHelperContributions([])
      toast.success('Helper link revoked')
    } catch (err) {
      toast.error(err.message || 'Could not revoke link')
    }
  }

  function handleImportAllHelperTimes() {
    if (!helperContributions.length) return
    setEnteredTimes(prev => mergeHelperContributions(prev, helperContributions))
    toast.success('Imported helper times (your entries were kept where set)')
  }

  function handleImportEntryHelperTimes(entry) {
    if (!helperContributions.length) return
    const ek = entryKey(entry)
    setEnteredTimes(prev => mergeHelperContributions(prev, helperContributions, ek))
    toast.success(`Imported helper times for ${entry.horseName}`)
  }

  function eventLabel(event) {
    if (!event) return '—'
    return `Q${event.qualifier_number} · ${event.venue} · ${new Date(event.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`
  }

  const contributionsByEntry = useMemo(() => {
    const map = {}
    for (const row of helperContributions) {
      if (!map[row.entry_key]) map[row.entry_key] = []
      map[row.entry_key].push(row)
    }
    return map
  }, [helperContributions])

  return (
    <div className="max-w-2xl mx-auto px-4 pb-32">
      <PageHeader
        title="Event Day"
        description="Upload the running list, find your riders, then track and save times as the day goes by."
        icon={ClipboardList}
      />

      {/* ── Main tab switcher ─────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveMainTab('event')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
            activeMainTab === 'event'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardList size={15} />
          Event Day
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
            activeMainTab === 'history'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <History size={15} />
          History
        </button>
      </div>

      {activeMainTab === 'history' && <EventDayHistory embedded />}

      {activeMainTab === 'event' && <>

      <div className="flex items-center gap-1 sm:gap-2 mb-6 overflow-x-auto pb-1">
        {['Running List', 'Find Riders', 'Rider Info', 'Select & Setup', 'Track & Save'].map((label, i) => {
          const num = i + 1
          const active = step === num
          const done = step > num
          return (
            <div key={label} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <div className={`flex items-center gap-1 sm:gap-1.5 ${active ? 'text-green-700' : done ? 'text-green-500' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-green-700 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {done ? <Check size={12} /> : num}
                </div>
                <span className={`text-[10px] sm:text-xs font-medium hidden md:block whitespace-nowrap ${active ? 'text-green-700' : done ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
              </div>
              {i < 4 && <div className={`h-px w-3 sm:w-6 md:flex-1 md:min-w-[8px] ${step > num ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          )
        })}
      </div>

      {/* ── STEP 1: UPLOAD RUNNING LIST ─────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardContent className="space-y-5 py-6">
            {resumeDraft && !entries.length && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-green-800">Active session found</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {resumeDraft.entries.length} entries · resuming…
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEndEvent}
                  className="text-xs text-red-500 hover:text-red-700 font-medium flex-shrink-0"
                >
                  End event
                </button>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-800 mb-0.5">Upload the running list</p>
              <p className="text-xs text-gray-500">Start with the KlipKlop running list PDF for today&apos;s qualifier.</p>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${dragOver ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
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
                <p className="text-xs text-green-600 mt-1">Next: search for your riders by name.</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button
                disabled={!entries.length}
                onClick={() => setStep(2)}
                className="flex items-center gap-2"
              >
                Find riders <ChevronRight size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: FIND RIDERS (enter names) ───────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardContent className="space-y-5 py-6">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-0.5">Who are you tracking?</p>
              <p className="text-xs text-gray-500">Enter a rider or horse name from the running list. Search as many times as you need.</p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFindRider()}
                placeholder="Rider or horse name…"
                className="flex-1 h-11 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                autoComplete="off"
              />
              <Button onClick={handleFindRider} disabled={!nameSearch.trim()} className="flex-shrink-0">
                Find
              </Button>
            </div>

            {searchTerms.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {searchTerms.map((term, i) => (
                  <span key={`${term}-${i}`} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {term}
                  </span>
                ))}
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-gray-800">{matchedEntries.length} rider{matchedEntries.length !== 1 ? 's' : ''} found</p>
              <p className="text-xs text-gray-500 mt-1">
                {matchedEntries.length
                  ? 'Continue to review their running list details.'
                  : 'Search for at least one rider or horse to continue.'}
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)} className="flex items-center gap-2">
                <ChevronLeft size={16} /> Back
              </Button>
              <Button
                disabled={!matchedIds.size}
                onClick={() => setStep(3)}
                className="flex items-center gap-2"
              >
                Review riders <ChevronRight size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 3: RIDER INFO (review matches) ─────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 py-6">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">Running list details</p>
                <p className="text-xs text-gray-500">
                  Confirm these are the right riders from the list.
                  {profileMatchCount > 0 && (
                    <span className="text-green-700"> {profileMatchCount} match your profile horses.</span>
                  )}
                </p>
              </div>

              <div className="space-y-3">
                {[...matchedEntries].sort((a, b) => a.runNumber - b.runNumber).map(entry => {
                  const combo = findMatchingCombo(entry, myCombos)
                  return (
                    <div
                      key={entryKey(entry)}
                      className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0 mt-0.5">
                        #{entry.runNumber}
                      </div>
                      <EntryInfoCard entry={entry} />
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {combo && (
                          <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">Your horse</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMatched(entry)}
                          className="text-gray-400 hover:text-red-500 p-1"
                          aria-label="Remove from list"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(2)} className="flex items-center gap-2">
              <ChevronLeft size={16} /> Back
            </Button>
            <Button
              disabled={!matchedIds.size}
              onClick={() => setStep(4)}
              className="flex items-center gap-2"
            >
              Select riders <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: SELECT RIDERS + EVENT SETUP ─────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 py-6">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">Select riders to track</p>
                <p className="text-xs text-gray-500">Choose which combos you want to enter times for today.</p>
              </div>

              <div className="space-y-2">
                {[...matchedEntries].sort((a, b) => a.runNumber - b.runNumber).map(entry => {
                  const key = entryKey(entry)
                  const isSelected = selectedIds.has(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSelectEntry(entry)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition ${isSelected ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200 hover:border-green-200'}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                        {isSelected && <Check size={11} className="text-white" />}
                      </div>
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                        #{entry.runNumber}
                      </div>
                      <EntryInfoCard entry={entry} />
                    </button>
                  )
                })}
              </div>

              {selectedIds.size > 0 && (
                <p className="text-xs font-semibold text-green-700">
                  {selectedIds.size} rider{selectedIds.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5 py-6">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">Which qualifier is today?</p>
                <p className="text-xs text-gray-500">Needed to know which games to track.</p>
              </div>

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
                  className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${isBackToBack ? 'bg-green-600' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${isBackToBack ? 'translate-x-5 left-0.5' : 'left-0.5'}`} />
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
            </CardContent>
          </Card>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(3)} className="flex items-center gap-2">
              <ChevronLeft size={16} /> Back
            </Button>
            <Button
              disabled={!selectedIds.size || !primaryEvent || (isBackToBack && !secondaryEvent)}
              onClick={() => setStep(5)}
              className="flex items-center gap-2"
            >
              Track {selectedIds.size} rider{selectedIds.size !== 1 ? 's' : ''} <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 5: TRACK & SAVE ────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="bg-green-800 text-white rounded-xl px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-xs font-semibold uppercase tracking-wide">Today&apos;s Event{activeEvents.length > 1 ? 's' : ''}</p>
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

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Link2 size={16} className="text-green-700" />
                Share with helpers
              </p>
              {helperSessionToken && (
                <button
                  type="button"
                  onClick={refreshHelperContributions}
                  disabled={loadingContributions}
                  className="text-xs text-green-700 font-medium flex items-center gap-1 hover:text-green-900"
                >
                  <RefreshCw size={14} className={loadingContributions ? 'animate-spin' : ''} />
                  Refresh
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Family or trainers can enter times on their phones. You review and save to your account.
            </p>
            {helperSessionUrl ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 break-all bg-gray-50 rounded-lg px-3 py-2">{helperSessionUrl}</p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1 text-sm"
                    onClick={() => copyAndShare({ url: helperSessionUrl, shareMessage: helperSessionUrl, shareTitle: 'Event Day' })}
                  >
                    Copy link
                  </Button>
                  <button
                    type="button"
                    onClick={handleRevokeHelperLink}
                    className="px-3 text-red-600 hover:bg-red-50 rounded-lg transition"
                    aria-label="Revoke link"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <Button
                onClick={handleCreateHelperLink}
                disabled={creatingHelperLink || !selectedEntries.length}
                className="w-full flex items-center justify-center gap-2"
              >
                <Link2 size={16} />
                {creatingHelperLink ? 'Creating…' : 'Create helper link'}
              </Button>
            )}
          </div>

          {helperContributions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-900">
                  Helper times ({helperContributions.length} entries)
                </p>
                <Button
                  variant="ghost"
                  className="text-xs text-amber-800"
                  onClick={handleImportAllHelperTimes}
                >
                  <Download size={14} className="mr-1" />
                  Import all
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedEntries.filter(e => contributionsByEntry[entryKey(e)]?.length).map(entry => {
                  const rows = contributionsByEntry[entryKey(entry)] || []
                  const label = rows[0]?.helper_label || 'Helper'
                  return (
                    <div key={entryKey(entry)} className="flex items-center justify-between gap-2 text-xs bg-white/60 rounded-lg px-3 py-2">
                      <span className="text-gray-700 truncate">
                        #{entry.runNumber} {entry.horseName}
                        <span className="text-gray-400 ml-1">· {label} · {rows.length} game{rows.length !== 1 ? 's' : ''}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleImportEntryHelperTimes(entry)}
                        className="text-amber-800 font-semibold hover:underline flex-shrink-0"
                      >
                        Import
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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

          {entries.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRunningList(v => !v)}
                className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-gray-800 hover:bg-gray-50 transition"
              >
                <span className="flex items-center gap-2">
                  <List size={15} className="text-green-700" />
                  Running Order ({entries.length} entries)
                </span>
                <ChevronDown size={15} className={`text-gray-400 transition-transform ${showRunningList ? 'rotate-180' : ''}`} />
              </button>
              {showRunningList && (
                <div className="border-t border-gray-100 p-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Search name or horse…"
                    value={runningListSearch}
                    onChange={e => setRunningListSearch(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {(runningListSearch ? findEntriesInList(entries, runningListSearch) : entries).map(e => {
                      const isSelected = selectedIds.has(entryKey(e))
                      return (
                        <div
                          key={entryKey(e)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isSelected ? 'border-l-4 border-green-600 bg-green-50' : 'bg-gray-50'}`}
                        >
                          <span className="text-xs font-bold text-gray-400 w-8 flex-shrink-0">#{e.runNumber}</span>
                          <EntryInfoCard entry={e} showClub={false} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 px-1 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><StatusDot status="empty" /> No times</div>
            <div className="flex items-center gap-1.5"><StatusDot status="partial" /> Partial</div>
            <div className="flex items-center gap-1.5"><StatusDot status="complete" /> Complete</div>
          </div>

          {selectedEntries.map(entry => {
            const status = entryStatus(entry, enteredTimes, activeEvents)
            const hasHelper = Boolean(contributionsByEntry[entryKey(entry)]?.length)
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
                        {matchedIds.has(entryKey(entry))
                          ? <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">✓ PB matched</span>
                          : <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">No match</span>
                        }
                        {hasHelper && (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Helper times</span>
                        )}
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

                {matchedIds.has(entryKey(entry)) && Object.keys(entryPBs[entryKey(entry)] || {}).length > 0 && (
                  <div className="border-t border-gray-100 px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 bg-green-50/40">
                    <span className="text-[10px] font-semibold text-green-700 self-center mr-1">PB:</span>
                    {activeEvents.map(event => {
                      const games = QUALIFIER_GAMES[event.qualifier_number] || []
                      return games.map(game => {
                        const pb = entryPBs[entryKey(entry)]?.[normalizeGameName(game) || game]
                        if (pb == null) return null
                        return (
                          <div key={`${event.id}-${game}`} className="flex items-center gap-1 text-xs">
                            <span className="text-gray-500">{game}:</span>
                            <span className="font-semibold text-green-700">{parseFloat(pb).toFixed(3)}s</span>
                          </div>
                        )
                      })
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => setStep(4)}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition flex items-center justify-center gap-2"
          >
            <Users size={16} /> Add / remove riders
          </button>
        </div>
      )}

      {step === 5 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 z-40">
          <div className="max-w-2xl mx-auto px-4 py-3 flex gap-3 items-center">
            <button
              type="button"
              onClick={handleDoneForNow}
              className="text-sm text-green-700 hover:text-green-900 font-medium px-2 flex-shrink-0"
            >
              Done for now
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? 'Saving…' : 'Save All Times'}
            </button>
            <button
              type="button"
              onClick={handleEndEvent}
              className="text-sm text-red-500 hover:text-red-700 font-medium px-2 flex-shrink-0"
            >
              End event
            </button>
          </div>
        </div>
      )}

      <EventDayTimeModal
        entry={timeModalEntry}
        activeEvents={activeEvents}
        getGameEntry={getGameEntry}
        setGameEntry={setGameEntry}
        pbs={timeModalEntry ? (entryPBs[entryKey(timeModalEntry)] || {}) : {}}
        onClose={() => setTimeModalEntry(null)}
      />

      </> /* end activeMainTab === 'event' */}
    </div>
  )
}
