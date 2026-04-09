import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { QUALIFIER_GAMES, normalizeGameName } from '../../lib/constants'
import { getLevel } from '../../lib/matrix'
import {
  ChevronDown,
  Save,
  Plus,
  Star,
  AlertCircle,
  Check,
  X,
  Pencil,
  Trash2,
  Upload,
  Search
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, Skeleton } from '../../components/ui'

const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700'
}

const CURRENT_YEAR = new Date().getFullYear()

function buildYearOptions() {
  const years = []
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 4; y--) {
    years.push(y)
  }
  return years
}

export default function QualifierTracker() {
  const { profile, isClubHead } = useAuth()
  const [step, setStep] = useState(1)
  const [events, setEvents] = useState([])
  const [combos, setCombos] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedCombo, setSelectedCombo] = useState(null)
  const [gameEntries, setGameEntries] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [savedSessions, setSavedSessions] = useState([])
  const [editingSession, setEditingSession] = useState(null)
  const [activeTab, setActiveTab] = useState('enter')
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [eventSearch, setEventSearch] = useState('')
  const pdfInputRef = useRef(null)
  const [processingPDF, setProcessingPDF] = useState(false)

  // Club head: linked riders
  const [linkedRiders, setLinkedRiders] = useState([])
  const [selectedRider, setSelectedRider] = useState(null)
  const [loadingRiders, setLoadingRiders] = useState(false)

  const effectiveUserId = isClubHead ? (selectedRider?.id || null) : profile?.id
  const effectiveProfile = isClubHead && selectedRider ? selectedRider : profile

  useEffect(() => {
    if (!profile) return
    if (isClubHead) {
      fetchLinkedRiders()
    } else {
      fetchCombos()
    }
  }, [profile])

  useEffect(() => {
    if (isClubHead && selectedRider) {
      fetchCombos()
    }
  }, [selectedRider])

  useEffect(() => {
    if (profile) {
      fetchEvents()
      fetchSavedSessions()
    }
  }, [profile, selectedYear, selectedRider])

  useEffect(() => {
    // Check for extracted times from PDF upload
    const extracted = sessionStorage.getItem('extracted_times')
    if (extracted) {
      const { times, combo_id, horse_name } = JSON.parse(extracted)
      sessionStorage.removeItem('extracted_times')
      toast.success(`Auto-filled times from PDF for ${horse_name}!`)

      // Pre-fill game entries
      const entries = {}
      Object.entries(times).forEach(([game, time]) => {
        entries[game] = {
          time: time === 'NT' ? '' : String(time),
          is_nt: time === 'NT',
          penalties: 0,
          level_entered: selectedCombo?.current_level ?? 0
        }
      })
      setGameEntries(entries)
    }
  }, [])

  async function fetchLinkedRiders() {
    setLoadingRiders(true)
    try {
      const { data: links } = await supabase
        .from('club_member_links')
        .select('rider_id')
        .eq('club_head_id', profile.id)
        .eq('status', 'accepted')

      if (!links || links.length === 0) {
        setLinkedRiders([])
        setLoading(false)
        return
      }

      const riderIds = links.map(l => l.rider_id)
      const { data: riders } = await supabase
        .from('profiles')
        .select('id, rider_name, province, scoresheet_name, profile_photo_url')
        .in('id', riderIds)

      const riderList = riders || []
      setLinkedRiders(riderList)
      if (riderList.length > 0) setSelectedRider(riderList[0])
    } finally {
      setLoadingRiders(false)
    }
  }

  async function fetchEvents() {
    const yearStart = `${selectedYear}-01-01`
    const yearEnd = `${selectedYear}-12-31`
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('qualifier_events')
      .select('*')
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .lte('date', today)
      .order('date', { ascending: false })
      .limit(20)

    setEvents(data || [])
    setLoading(false)
  }

  async function fetchCombos() {
    const uid = isClubHead ? selectedRider?.id : profile?.id
    if (!uid) return
    const { data } = await supabase
      .from('horse_rider_combos')
      .select('*')
      .eq('user_id', uid)
      .eq('is_archived', false)

    setCombos(data || [])
  }

  async function fetchSavedSessions() {
    const yearStart = `${selectedYear}-01-01`
    const yearEnd = `${selectedYear}-12-31`

    // First get event IDs for the selected year
    const { data: yearEvents } = await supabase
      .from('qualifier_events')
      .select('id')
      .gte('date', yearStart)
      .lte('date', yearEnd)

    const yearEventIds = yearEvents?.map(e => e.id) || []

    if (yearEventIds.length === 0) {
      setSavedSessions([])
      return
    }

    const uid = isClubHead ? selectedRider?.id : profile?.id
    if (!uid) { setSavedSessions([]); return }

    const { data } = await supabase
      .from('qualifier_results')
      .select(`
        *,
        qualifier_events (date, venue, province, qualifier_number),
        horse_rider_combos (horse_name)
      `)
      .eq('horse_rider_combos.user_id', uid)
      .in('event_id', yearEventIds)
      .order('created_at', { ascending: false })

    // Group by event + combo
    const grouped = {}
    data?.forEach(result => {
      const key = `${result.event_id}_${result.combo_id}`
      if (!grouped[key]) {
        grouped[key] = {
          key,
          event_id: result.event_id,
          combo_id: result.combo_id,
          event: result.qualifier_events,
          horse: result.horse_rider_combos,
          results: []
        }
      }
      grouped[key].results.push(result)
    })

    setSavedSessions(Object.values(grouped))
  }

  function initGameEntries(event) {
    const games = QUALIFIER_GAMES[event.qualifier_number] || []
    const entries = {}
    games.forEach(game => {
      entries[game] = {
        time: '',
        is_nt: false,
        penalties: 0,
        level_entered: selectedCombo?.current_level ?? 0
      }
    })
    setGameEntries(entries)
  }

  function handleEventSelect(event) {
    setSelectedEvent(event)
    initGameEntries(event)
    setStep(2)
  }

  function handleComboSelect(combo) {
    setSelectedCombo(combo)
    // Default "level entered" to the combo's current level for all games (still editable)
    setGameEntries(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(game => {
        next[game] = {
          ...next[game],
          level_entered: combo?.current_level ?? 0,
        }
      })
      return next
    })
    setStep(3)
  }

  async function handlePDFUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // allow uploading the same file again later
    if (pdfInputRef.current) pdfInputRef.current.value = ''

    if (file.type && file.type !== 'application/pdf') {
      toast.error('Please choose a PDF file')
      return
    }

    if (!effectiveProfile?.scoresheet_name && !effectiveProfile?.rider_name) {
      toast.error('Please set the scoresheet name in the rider\'s profile first')
      return
    }

    if (!selectedEvent || !selectedCombo) {
      toast.error('Please select an event and horse first')
      return
    }

    setProcessingPDF(true)
    toast.loading('Processing PDF...')

    try {
      const games = Object.keys(gameEntries)
      const pages = await extractPagesFromPDF(file)
      const { times } = extractTimesFromPDFPages({
        pages,
        games,
        searchName: effectiveProfile.scoresheet_name || effectiveProfile.rider_name,
        horseName: selectedCombo.horse_name,
      })

      if (Object.keys(times).length === 0) {
        toast.dismiss()
        toast.error('Could not find your times in this PDF. Check your scoresheet name in profile settings.')
        return
      }

      // Merge extracted times into existing entries (keeps penalties/level_entered defaults)
      setGameEntries(prev => {
        const next = { ...prev }
        for (const [game, t] of Object.entries(times)) {
          if (!next[game]) continue
          next[game] = {
            ...next[game],
            time: t === 'NT' ? '' : String(t),
            is_nt: t === 'NT',
          }
        }
        return next
      })

      toast.dismiss()
      toast.success(`Auto-filled ${Object.keys(times).length} time${Object.keys(times).length === 1 ? '' : 's'} from PDF`)
    } catch (error) {
      toast.dismiss()
      toast.error(error?.message ? `Error processing PDF: ${error.message}` : 'Error processing PDF')
      console.error(error)
    } finally {
      setProcessingPDF(false)
    }
  }

  function extractPagesFromPDF(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/legacy/build/pdf.worker.mjs',
            import.meta.url
          ).toString()

          const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise
          const pages = []

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            const items = content.items.map(item => String(item.str || '')).filter(Boolean)
            const pageText = items.join(' ')
            pages.push({ pageText, items })
          }

          resolve(pages)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  function extractTimesFromPDFPages({ pages, games, searchName, horseName }) {
    const times = {}

    const normalize = (s) => {
      if (!s) return ''
      return String(s)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s.,-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const nameNorm = normalize(searchName)
    const horseNorm = normalize(horseName)
    const gameList = Array.isArray(games) ? games : []

    const nameTokens = nameNorm
      .split(/[\s,.-]+/)
      .map(t => t.trim())
      .filter(t => t.length >= 2)

    const STOP_TOKENS = new Set([
      'van', 'der', 'de', 'den', 'du', 'la', 'le', 'da', 'di', 'von'
    ])

    const nameTokensStrong = nameTokens.filter(t => !STOP_TOKENS.has(t) && t.length >= 3)
    const firstStrong = nameTokensStrong[0] || nameTokens[0] || ''
    const lastStrong =
      (nameTokensStrong.length > 0 ? nameTokensStrong[nameTokensStrong.length - 1] : '') ||
      (nameTokens.length > 0 ? nameTokens[nameTokens.length - 1] : '')

    const pageHasName = (pageNorm, requireHorse) => {
      if (!pageNorm) return false
      if (requireHorse && horseNorm && !pageNorm.includes(horseNorm)) return false
      if (nameNorm && pageNorm.includes(nameNorm)) return true
      if (firstStrong && lastStrong) return pageNorm.includes(firstStrong) && pageNorm.includes(lastStrong)
      if (nameTokens.length === 0) return false
      return nameTokens.some(t => pageNorm.includes(t))
    }

    const parseTime = (raw) => {
      if (!raw) return null
      const ntMatch = raw.match(/\bNT\b/i)
      if (ntMatch) return 'NT'
      const timeMatch = raw.match(/\b(\d{1,3}[.,]\d{3})\b/)
      if (!timeMatch) return null
      return parseFloat(timeMatch[1].replace(',', '.'))
    }

    const findGameOnPage = (pageNorm) => {
      for (const game of gameList) {
        const g = normalize(game)
        if (g && pageNorm.includes(g)) return game
      }
      return null
    }

    const itemWindowMatchesName = (windowNorm, requireHorse) => {
      if (!windowNorm) return false
      if (requireHorse && horseNorm && !windowNorm.includes(horseNorm)) return false
      if (nameNorm && windowNorm.includes(nameNorm)) return true
      if (firstStrong && lastStrong) return windowNorm.includes(firstStrong) && windowNorm.includes(lastStrong)
      if (nameTokens.length === 0) return false
      return nameTokens.some(t => windowNorm.includes(t))
    }

    const extractTimeFromItems = (items) => {
      if (!Array.isArray(items) || items.length === 0) return null

      const normItems = items.map(it => normalize(it))

      const windowSize = 10
      for (let i = 0; i < normItems.length; i++) {
        const start = Math.max(0, i - windowSize + 1)
        const windowNorm = normItems.slice(start, i + 1).join(' ')

        const matches =
          itemWindowMatchesName(windowNorm, true) || itemWindowMatchesName(windowNorm, false)
        if (!matches) continue

        for (let j = i + 1; j < Math.min(items.length, i + 80); j++) {
          const t = parseTime(items[j])
          if (t !== null) return t
        }
      }

      return null
    }

    if (!Array.isArray(pages) || gameList.length === 0 || !nameNorm) {
      return { times }
    }

    const extractedInOrder = []

    for (const page of pages) {
      const pageText = page?.pageText || ''
      const pageItems = page?.items || []
      const pageNorm = normalize(pageText)
      const game = findGameOnPage(pageNorm)

      const t = extractTimeFromItems(pageItems)
      if (t !== null) {
        if (game) times[game] = t
        extractedInOrder.push({ game, time: t })
      }
    }

    // Fallback: map extracted times in order to the qualifier's games list
    if (Object.keys(times).length === 0 && extractedInOrder.length > 0) {
      const picked = extractedInOrder.map(x => x.time).slice(0, gameList.length)
      picked.forEach((t, idx) => {
        times[gameList[idx]] = t
      })
    }

    return { times }
  }

  function handleTimeChange(game, field, value) {
    setGameEntries(prev => ({
      ...prev,
      [game]: {
        ...prev[game],
        [field]: value
      }
    }))
  }

  function toggleNT(game) {
    setGameEntries(prev => ({
      ...prev,
      [game]: {
        ...prev[game],
        is_nt: !prev[game].is_nt,
        time: ''
      }
    }))
  }

  function getFinalTime(game) {
    const entry = gameEntries[game]
    if (!entry || entry.is_nt) return null
    const time = parseFloat(entry.time)
    const penalties = parseFloat(entry.penalties) || 0
    if (isNaN(time)) return null
    return time + penalties
  }

  function getLiveLevel(game) {
    const finalTime = getFinalTime(game)
    if (finalTime === null) return null
    return getLevel(game, finalTime)
  }

  function getLiveOvercount(game) {
    const entry = gameEntries[game]
    if (!entry) return 0
    const levelEntered = parseInt(entry.level_entered) || 0
    const levelAchieved = getLiveLevel(game)
    if (levelAchieved === null) return 0
    return Math.max(0, levelAchieved - levelEntered)
  }

  function getTotalOvercount() {
    return Object.keys(gameEntries).reduce((sum, game) => {
      return sum + getLiveOvercount(game)
    }, 0)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const resultsToInsert = []
      const pbUpdates = []

      // Derive season_year from the selected event's date
      const eventYear = selectedEvent?.date
        ? new Date(selectedEvent.date).getFullYear()
        : CURRENT_YEAR
      const achievedAt = selectedEvent?.date
        ? `${selectedEvent.date}T00:00:00.000Z`
        : new Date().toISOString()

      for (const [game, entry] of Object.entries(gameEntries)) {
        const normalizedGame = normalizeGameName(game)
        const finalTime = getFinalTime(game)
        const levelAchieved = getLiveLevel(game)

        resultsToInsert.push({
          combo_id: selectedCombo.id,
          event_id: selectedEvent.id,
          game: normalizedGame,
          time: finalTime,
          is_nt: entry.is_nt,
          level_entered: parseInt(entry.level_entered) || 0,
          level_achieved: levelAchieved,
          penalties: parseFloat(entry.penalties) || 0
        })

        // Check if this is a new PB for this year
        if (finalTime !== null) {
          const { data: existingPB } = await supabase
            .from('personal_bests')
            .select('*')
            .eq('combo_id', selectedCombo.id)
            .eq('game', normalizedGame)
            .eq('season_year', eventYear)
            .maybeSingle()

          if (!existingPB || finalTime < existingPB.best_time) {
            pbUpdates.push({
              combo_id: selectedCombo.id,
              game: normalizedGame,
              best_time: finalTime,
              season_year: eventYear,
              achieved_at: achievedAt,
              updated_at: new Date().toISOString()
            })
          }
        }
      }

      // Insert results
      const { error: resultsError } = await supabase
        .from('qualifier_results')
        .insert(resultsToInsert)

      if (resultsError) throw resultsError

      // Upsert personal bests (per combo, game, and year)
      if (pbUpdates.length > 0) {
        const { error: pbError } = await supabase
          .from('personal_bests')
          .upsert(pbUpdates, {
            onConflict: 'combo_id,game,season_year',
            ignoreDuplicates: false
          })

        if (pbError) throw pbError

        // Send notification for new PBs
        await supabase.from('notifications').insert({
          user_id: profile.id,
          type: 'new_pb',
          message: `New personal best${pbUpdates.length > 1 ? 's' : ''} set for ${pbUpdates.map(p => p.game).join(', ')}!`,
          link: '/my-times'
        })
      }

      toast.success('Times saved successfully!')
      setShowSummary(false)
      setStep(1)
      setSelectedEvent(null)
      setSelectedCombo(null)
      setGameEntries({})
      fetchSavedSessions()

    } catch (error) {
      toast.error('Error saving times')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteSession(session) {
    if (!confirm('Delete all results for this session?')) return

    try {
      const { error } = await supabase
        .from('qualifier_results')
        .delete()
        .eq('event_id', session.event_id)
        .eq('combo_id', session.combo_id)

      if (error) throw error
      toast.success('Session deleted')
      fetchSavedSessions()
    } catch (error) {
      toast.error('Error deleting session')
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64" />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Qualifier Tracker"
        description={
          isClubHead
            ? selectedRider
              ? `Entering times for ${selectedRider.rider_name}`
              : 'Select a rider to enter times'
            : 'Enter your times from a qualifier'
        }
      />

      {/* Rider selector — club_head only */}
      {isClubHead && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {loadingRiders ? (
            <div className="text-sm text-gray-400">Loading riders…</div>
          ) : linkedRiders.length === 0 ? (
            <div className="text-sm text-gray-400">
              No riders linked yet.{' '}
              <a href="/my-club-riders" className="text-green-700 font-medium hover:underline">Go to My Riders →</a>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-600">Rider:</span>
              <div className="flex gap-2 flex-wrap">
                {linkedRiders.map(rider => (
                  <button
                    key={rider.id}
                    onClick={() => {
                      setSelectedRider(rider)
                      setStep(1)
                      setSelectedEvent(null)
                      setSelectedCombo(null)
                      setGameEntries({})
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      selectedRider?.id === rider.id
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {rider.rider_name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('enter')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'enter'
              ? 'border-green-700 text-green-800'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Enter Times
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'history'
              ? 'border-green-700 text-green-800'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Session History
        </button>
      </div>

      {/* Enter times tab */}
      {activeTab === 'enter' && (
        <div className="space-y-6">

          {/* Year selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Season:</span>
            <div className="relative inline-block">
              <select
                value={selectedYear}
                onChange={e => {
                  setSelectedYear(Number(e.target.value))
                  setStep(1)
                  setSelectedEvent(null)
                  setSelectedCombo(null)
                  setGameEntries({})
                  setEventSearch('')
                }}
                className="appearance-none pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white font-medium"
              >
                {buildYearOptions().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-2">
            {[
              { num: 1, label: 'Select event' },
              { num: 2, label: 'Select combo' },
              { num: 3, label: 'Enter times' }
            ].map(({ num, label }) => (
              <div key={num} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                  step > num
                    ? 'bg-green-600 text-white'
                    : step === num
                    ? 'bg-green-100 text-green-700 ring-2 ring-green-600'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > num ? <Check size={16} /> : num}
                </div>
                <span className={`text-sm hidden sm:block ${
                  step === num ? 'text-green-700 font-medium' : 'text-gray-400'
                }`}>
                  {label}
                </span>
                {num < 3 && (
                  <div className={`w-8 h-0.5 ${step > num ? 'bg-green-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1 — Select event */}
          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">
                Select a qualifier event
              </h2>

              {/* Search box */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={eventSearch}
                  onChange={e => setEventSearch(e.target.value)}
                  placeholder="Search by Q1, venue, town, province…"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                />
                {eventSearch && (
                  <button
                    onClick={() => setEventSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {(() => {
                const q = eventSearch.trim().toLowerCase()
                const filtered = q
                  ? events.filter(e => {
                      const haystack = [
                        e.qualifier_number != null ? `q${e.qualifier_number}` : '',
                        e.qualifier_number != null ? `qualifier ${e.qualifier_number}` : '',
                        e.venue ?? '',
                        e.province ?? '',
                        e.event_type ?? '',
                        e.notes ?? ''
                      ].join(' ').toLowerCase()
                      return haystack.includes(q)
                    })
                  : events

                if (events.length === 0) return (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                    No past events found for {selectedYear}. Events will appear here after they have been added by the admin.
                  </div>
                )
                if (filtered.length === 0) return (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                    No events match <strong>"{eventSearch}"</strong>. Try a different keyword.
                  </div>
                )
                return (
                <div className="space-y-2">
                  {filtered.map(event => (
                    <button
                      key={event.id}
                      onClick={() => handleEventSelect(event)}
                      className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-green-400 hover:bg-green-50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full capitalize">
                              {event.event_type}
                            </span>
                            {event.qualifier_number && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                Q{event.qualifier_number}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-gray-800 mt-1">
                            {event.venue}, {event.province}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(event.date).toLocaleDateString('en-ZA', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                          {event.qualifier_number && (
                            <p className="text-xs text-gray-400 mt-1">
                              Games: {QUALIFIER_GAMES[event.qualifier_number]?.join(', ')}
                            </p>
                          )}
                        </div>
                        <ChevronDown size={20} className="text-gray-300 -rotate-90" />
                      </div>
                    </button>
                  ))}
                </div>
                )
              })()}
            </div>
          )}

          {/* Step 2 — Select combo */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
                <h2 className="text-lg font-semibold text-gray-800">
                  Select your horse/rider combo
                </h2>
              </div>

              {/* Selected event summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                {selectedEvent?.venue}, {selectedEvent?.province} ·{' '}
                {new Date(selectedEvent?.date).toLocaleDateString()} ·{' '}
                Q{selectedEvent?.qualifier_number}
              </div>

              {combos.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                  No horse/rider combos found. Add one in your profile first.
                </div>
              ) : (
                <div className="space-y-2">
                  {combos.map(combo => (
                    <button
                      key={combo.id}
                      onClick={() => handleComboSelect(combo)}
                      className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-green-400 hover:bg-green-50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-700 font-bold">
                              {combo.horse_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{combo.horse_name}</p>
                            <p className="text-sm text-gray-500">{profile?.rider_name}</p>
                            {combo.is_pinned && (
                              <p className="text-xs text-green-600">★ Pinned</p>
                            )}
                          </div>
                        </div>
                        <ChevronDown size={20} className="text-gray-300 -rotate-90" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Enter times */}
          {step === 3 && !showSummary && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
                <h2 className="text-lg font-semibold text-gray-800">
                  Enter your times
                </h2>
              </div>

              {/* Session summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center justify-between">
                <div>
                  <span className="font-medium">{selectedCombo?.horse_name}</span>
                  {' · '}
                  {selectedEvent?.venue}, {selectedEvent?.province}
                  {' · '}
                  {new Date(selectedEvent?.date).toLocaleDateString()}
                </div>
                <div className="font-bold">
                  Total overcount: {getTotalOvercount()}
                </div>
              </div>

              {/* PDF upload */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">Upload scoresheet (optional)</p>
                  <p className="text-sm text-gray-500">
                    Upload your PDF to auto-fill the times, or enter them manually below.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={processingPDF}
                    className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white h-10 px-4 text-sm bg-white text-gray-900 border border-gray-200 hover:bg-gray-50"
                  >
                    <Upload size={16} />
                    {processingPDF ? 'Processing…' : 'Upload PDF'}
                  </button>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePDFUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Game entries */}
              <div className="space-y-3">
                {Object.entries(gameEntries).map(([game, entry]) => {
                  const finalTime = getFinalTime(game)
                  const liveLevel = getLiveLevel(game)
                  const overcount = getLiveOvercount(game)

                  return (
                    <div
                      key={game}
                      className="bg-white rounded-xl border border-gray-200 p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-800">{game}</h3>
                        <div className="flex items-center gap-2">
                          {liveLevel !== null && (
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${LEVEL_STYLES[liveLevel]}`}>
                              L{liveLevel}
                            </span>
                          )}
                          {overcount > 0 && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                              +{overcount} overcount
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Time input */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Time (seconds)
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={entry.time}
                            onChange={e => handleTimeChange(game, 'time', e.target.value)}
                            disabled={entry.is_nt}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400"
                            placeholder="e.g. 22.724"
                          />
                        </div>

                        {/* Penalties */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Penalties (sec)
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={entry.penalties}
                            onChange={e => handleTimeChange(game, 'penalties', e.target.value)}
                            disabled={entry.is_nt}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                            placeholder="0"
                          />
                        </div>

                        {/* Level entered */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Level entered
                          </label>
                          <select
                            value={entry.level_entered}
                            onChange={e => handleTimeChange(game, 'level_entered', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            {[0, 1, 2, 3, 4].map(l => (
                              <option key={l} value={l}>Level {l}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* NT toggle */}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => toggleNT(game)}
                          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition ${
                            entry.is_nt
                              ? 'bg-red-100 text-red-700 font-medium'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {entry.is_nt ? <X size={12} /> : <AlertCircle size={12} />}
                          {entry.is_nt ? 'NT (click to remove)' : 'Mark as NT'}
                        </button>

                        {finalTime !== null && (
                          <span className="text-xs text-gray-500">
                            Final time: <strong>{finalTime.toFixed(3)}s</strong>
                            {parseFloat(entry.penalties) > 0 && (
                              <span className="text-orange-500">
                                {' '}(includes {entry.penalties}s penalty)
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Review button */}
              <button
                onClick={() => setShowSummary(true)}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
              >
                Review & Save
              </button>
            </div>
          )}

          {/* Summary / Review screen */}
          {step === 3 && showSummary && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSummary(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Edit times
                </button>
                <h2 className="text-lg font-semibold text-gray-800">
                  Review your times
                </h2>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <p className="font-semibold text-gray-800">
                    {selectedCombo?.horse_name} · {profile?.rider_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedEvent?.venue}, {selectedEvent?.province} ·{' '}
                    {new Date(selectedEvent?.date).toLocaleDateString()} ·{' '}
                    Q{selectedEvent?.qualifier_number}
                  </p>
                </div>

                <div className="divide-y divide-gray-100">
                  {Object.entries(gameEntries).map(([game, entry]) => {
                    const finalTime = getFinalTime(game)
                    const liveLevel = getLiveLevel(game)
                    const overcount = getLiveOvercount(game)

                    return (
                      <div key={game} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{game}</span>
                        <div className="flex items-center gap-2">
                          {entry.is_nt ? (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">NT</span>
                          ) : finalTime !== null ? (
                            <>
                              <span className="text-sm font-bold text-gray-800">
                                {finalTime.toFixed(3)}s
                              </span>
                              {liveLevel !== null && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_STYLES[liveLevel]}`}>
                                  L{liveLevel}
                                </span>
                              )}
                              {overcount > 0 && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                  +{overcount}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">No time entered</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Total overcount
                  </span>
                  <span className="text-lg font-bold text-green-700">
                    {getTotalOvercount()}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Times'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Session history tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">

          {/* Year selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Season:</span>
            <div className="relative inline-block">
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="appearance-none pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white font-medium"
              >
                {buildYearOptions().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {savedSessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No sessions saved for {selectedYear}. Enter your qualifier times to get started.
            </div>
          ) : (
            savedSessions.map(session => (
              <div
                key={session.key}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {session.horse?.horse_name} · {profile?.rider_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {session.event?.venue}, {session.event?.province} ·{' '}
                      {new Date(session.event?.date).toLocaleDateString()} ·{' '}
                      Q{session.event?.qualifier_number}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSession(session)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="divide-y divide-gray-100">
                  {session.results.map(result => {
                    const level = result.is_nt ? null : getLevel(result.game, result.time)
                    return (
                      <div key={result.id} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-gray-700">{result.game}</span>
                        <div className="flex items-center gap-2">
                          {result.is_nt ? (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">NT</span>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-gray-800">
                                {result.time?.toFixed(3)}s
                              </span>
                              {level !== null && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_STYLES[level]}`}>
                                  L{level}
                                </span>
                              )}
                            </>
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
    </div>
  )
}
