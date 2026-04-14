import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { PROVINCES, QUALIFIER_GAMES, canonicalizeGameLabel, normalizeGameName } from '../../lib/constants'
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
import { useTabQueryParam } from '../../lib/useTabQueryParam'

const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700'
}

const CURRENT_YEAR = new Date().getFullYear()
const PDF_FILE_EXTENSIONS = ['.pdf']
const QUALIFIER_TRACKER_TABS = ['enter', 'history', 'historical']

function buildYearOptions() {
  const years = []
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 4; y--) {
    years.push(y)
  }
  return years
}

function buildHistoricalYearOptions() {
  const years = []
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 15; y--) {
    years.push(y)
  }
  return years
}

function getAllQualifierGames() {
  return [...new Set(Object.values(QUALIFIER_GAMES).flat())]
}

function isPdfLikeFile(file) {
  if (!file) return false
  const normalizedName = String(file.name || '').toLowerCase()
  return file.type === 'application/pdf' || PDF_FILE_EXTENSIONS.some(ext => normalizedName.endsWith(ext))
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
  const [editingSessionEntries, setEditingSessionEntries] = useState({})
  const [activeTab, setActiveTab] = useState('enter')
  useTabQueryParam({
    activeTab,
    setActiveTab,
    allowedTabs: QUALIFIER_TRACKER_TABS,
  })

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [eventSearch, setEventSearch] = useState('')
  const [bookmarkedQualifiers, setBookmarkedQualifiers] = useState({})
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false)
  const [bookmarkPickerEvent, setBookmarkPickerEvent] = useState(null)
  const [bookmarkPickerComboId, setBookmarkPickerComboId] = useState('')
  const pdfInputRef = useRef(null)
  const [processingPDF, setProcessingPDF] = useState(false)
  const historicalPdfInputRef = useRef(null)
  const [historicalYear, setHistoricalYear] = useState(CURRENT_YEAR - 1)
  const [historicalComboId, setHistoricalComboId] = useState('')
  const [processingHistoricalPDF, setProcessingHistoricalPDF] = useState(false)
  const [historicalMethod, setHistoricalMethod] = useState('pdf')
  const [historicalManualEntries, setHistoricalManualEntries] = useState({})
  const [savingHistoricalManual, setSavingHistoricalManual] = useState(false)
  const [historicalManualQualifierNumber, setHistoricalManualQualifierNumber] = useState('')
  const [historicalManualVenue, setHistoricalManualVenue] = useState('')
  const [historicalManualProvince, setHistoricalManualProvince] = useState('')
  const [historicalPdfQualifierNumber, setHistoricalPdfQualifierNumber] = useState('')
  const [historicalPdfVenue, setHistoricalPdfVenue] = useState('')
  const [historicalPdfEntries, setHistoricalPdfEntries] = useState({})
  const [savingHistoricalPdf, setSavingHistoricalPdf] = useState(false)

  // Club head: linked riders
  const [linkedRiders, setLinkedRiders] = useState([])
  const [selectedRider, setSelectedRider] = useState(null)
  const [loadingRiders, setLoadingRiders] = useState(false)

  const effectiveUserId = isClubHead ? (selectedRider?.id || null) : profile?.id
  const effectiveProfile = isClubHead && selectedRider ? selectedRider : profile
  const bookmarkStorageKey = effectiveUserId ? `qualifier-bookmarks:${effectiveUserId}` : null

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
    if (selectedCombo?.id) {
      setHistoricalComboId(selectedCombo.id)
      return
    }
    if (!historicalComboId && combos.length > 0) {
      setHistoricalComboId(combos[0].id)
    }
  }, [selectedCombo, combos, historicalComboId])

  useEffect(() => {
    const qualifierNum = Number(historicalManualQualifierNumber)
    const games = QUALIFIER_GAMES[qualifierNum] || []
    const entries = {}
    games.forEach(game => {
      entries[game] = {
        time: '',
        is_nt: false
      }
    })
    setHistoricalManualEntries(entries)
  }, [historicalManualQualifierNumber])

  useEffect(() => {
    const qualifierNum = Number(historicalPdfQualifierNumber)
    const games = QUALIFIER_GAMES[qualifierNum] || []
    const entries = {}
    games.forEach(game => {
      entries[game] = {
        time: '',
        is_nt: false
      }
    })
    setHistoricalPdfEntries(entries)
  }, [historicalPdfQualifierNumber])

  useEffect(() => {
    if (profile) {
      fetchEvents()
    }
  }, [profile, selectedRider])

  useEffect(() => {
    if (profile) {
      fetchSavedSessions()
    }
  }, [profile, selectedYear, selectedRider])

  useEffect(() => {
    if (!bookmarkStorageKey) {
      setBookmarkedQualifiers({})
      return
    }
    try {
      const stored = localStorage.getItem(bookmarkStorageKey)
      const parsed = stored ? JSON.parse(stored) : {}
      setBookmarkedQualifiers(parsed && typeof parsed === 'object' ? parsed : {})
    } catch {
      setBookmarkedQualifiers({})
    }
  }, [bookmarkStorageKey])

  useEffect(() => {
    if (!selectedCombo && showBookmarkedOnly) {
      setShowBookmarkedOnly(false)
    }
  }, [selectedCombo, showBookmarkedOnly])

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
          is_nt: time === 'NT'
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
    const yearStart = `${CURRENT_YEAR}-01-01`
    const yearEnd = `${CURRENT_YEAR}-12-31`
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('qualifier_events')
      .select('*')
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .lte('date', today)
      .order('date', { ascending: false })

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
        is_nt: false
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
    setHistoricalComboId(combo.id)
    setStep(3)
  }

  function buildBookmarkKey(comboId, eventId) {
    return `${comboId}:${eventId}`
  }

  function isQualifierBookmarked(comboId, eventId) {
    return Boolean(bookmarkedQualifiers[buildBookmarkKey(comboId, eventId)])
  }

  function toggleQualifierBookmark(combo, event, nativeEvent = null) {
    nativeEvent?.stopPropagation?.()
    if (!bookmarkStorageKey || !combo?.id || !event?.id) return

    const bookmarkKey = buildBookmarkKey(combo.id, event.id)
    const alreadyBookmarked = isQualifierBookmarked(combo.id, event.id)

    setBookmarkedQualifiers(prev => {
      const next = { ...prev }
      if (alreadyBookmarked) {
        delete next[bookmarkKey]
      } else {
        next[bookmarkKey] = true
      }
      localStorage.setItem(bookmarkStorageKey, JSON.stringify(next))
      return next
    })

    if (alreadyBookmarked) {
      toast.success(`Removed bookmark for ${combo.horse_name}`)
    } else {
      toast.success(`Bookmarked qualifier for ${combo.horse_name}`)
    }
  }

  function openBookmarkComboPicker(event, nativeEvent = null) {
    nativeEvent?.stopPropagation?.()
    if (!event?.id) return
    setBookmarkPickerEvent(event)
    setBookmarkPickerComboId(selectedCombo?.id || combos[0]?.id || '')
  }

  function confirmBookmarkComboSelection() {
    if (!bookmarkPickerEvent?.id) return
    const combo = combos.find(c => c.id === bookmarkPickerComboId)
    if (!combo) {
      toast.error('Please select a horse/rider combo first')
      return
    }
    toggleQualifierBookmark(combo, bookmarkPickerEvent)
    setBookmarkPickerEvent(null)
    setBookmarkPickerComboId('')
  }

  async function getOrCreateHistoricalImportEvent({
    year,
    venue = 'Historical Import',
    province = 'N/A',
    qualifierNumber = null,
    notes = null
  }) {
    const eventDate = `${year}-12-31`
    const { data: existingEvent, error: existingError } = await supabase
      .from('qualifier_events')
      .select('id')
      .eq('event_type', 'historical_import')
      .eq('date', eventDate)
      .eq('venue', venue)
      .eq('province', province)
      .eq('qualifier_number', qualifierNumber)
      .maybeSingle()

    if (existingError) throw existingError
    if (existingEvent) return existingEvent.id

    const { data: createdEvent, error: createError } = await supabase
      .from('qualifier_events')
      .insert({
        date: eventDate,
        venue,
        province,
        event_type: 'historical_import',
        qualifier_number: qualifierNumber,
        notes: notes || `Auto-created historical import event for ${year}`,
      })
      .select('id')
      .single()

    if (createError) throw createError
    return createdEvent.id
  }

  async function handlePDFUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // allow uploading the same file again later
    if (pdfInputRef.current) pdfInputRef.current.value = ''

    if (!isPdfLikeFile(file)) {
      toast.error('Please choose a PDF scoresheet (phone uploads supported)')
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

      // Merge extracted times into existing entries
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

  async function handleHistoricalPDFUpload(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    if (historicalPdfInputRef.current) historicalPdfInputRef.current.value = ''

    if (!effectiveProfile?.scoresheet_name && !effectiveProfile?.rider_name) {
      toast.error('Please set the scoresheet name in the rider\'s profile first')
      return
    }

    if (!historicalComboId) {
      toast.error('Please select a horse/rider combo for historical import')
      return
    }

    const qualifierNumber = Number(historicalPdfQualifierNumber)
    if (!qualifierNumber || !QUALIFIER_GAMES[qualifierNumber]) {
      toast.error('Enter a valid qualifier number first')
      return
    }

    const selectedHistoricalCombo = combos.find(c => c.id === historicalComboId)
    if (!selectedHistoricalCombo) {
      toast.error('Selected combo could not be found')
      return
    }

    const nonPdf = files.find(file => !isPdfLikeFile(file))
    if (nonPdf) {
      toast.error('Please upload PDF files only')
      return
    }

    setProcessingHistoricalPDF(true)
    toast.loading('Reading PDF and extracting times...')

    try {
      const games = QUALIFIER_GAMES[qualifierNumber] || []
      const extractedByGame = {}
      let processedCount = 0

      for (const file of files) {
        try {
          const pages = await extractPagesFromPDF(file)
          const { times } = extractTimesFromPDFPages({
            pages,
            games,
            searchName: effectiveProfile.scoresheet_name || effectiveProfile.rider_name,
            horseName: selectedHistoricalCombo.horse_name,
          })

          const entries = Object.entries(times)
          if (entries.length === 0) {
            continue
          }

          processedCount += 1
          entries.forEach(([game, time]) => {
            const existing = extractedByGame[game]
            if (time === 'NT') {
              if (existing == null) extractedByGame[game] = 'NT'
              return
            }

            const numeric = Number(time)
            if (Number.isNaN(numeric)) return
            if (existing == null || existing === 'NT' || numeric < Number(existing)) {
              extractedByGame[game] = numeric
            }
          })
        } catch (error) {
          console.error('Historical PDF parse failed', file.name, error)
        }
      }

      if (Object.keys(extractedByGame).length === 0) {
        toast.dismiss()
        toast.error('No valid qualifier times found in uploaded PDFs')
        return
      }

      setHistoricalPdfEntries(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(game => {
          const value = extractedByGame[game]
          if (value == null) return
          next[game] = {
            ...next[game],
            time: value === 'NT' ? '' : String(value),
            is_nt: value === 'NT'
          }
        })
        return next
      })

      toast.dismiss()
      toast.success(
        `Auto-filled ${Object.keys(extractedByGame).length} game time${Object.keys(extractedByGame).length === 1 ? '' : 's'} from ${processedCount} PDF${processedCount === 1 ? '' : 's'}. Please verify and save.`
      )
    } catch (error) {
      toast.dismiss()
      toast.error('Historical PDF parse failed')
      console.error(error)
    } finally {
      setProcessingHistoricalPDF(false)
    }
  }

  async function saveHistoricalResults({ combo, year, historicalResults, eventMeta }) {
    const eventId = await getOrCreateHistoricalImportEvent({
      year,
      venue: eventMeta?.venue,
      province: eventMeta?.province,
      qualifierNumber: eventMeta?.qualifierNumber ?? null,
      notes: eventMeta?.notes || null
    })
    const resultsToInsert = []
    const pbBestByGame = {}

    historicalResults.forEach(({ game, time }) => {
      const normalizedGame = normalizeGameName(game)
      const isNt = time === 'NT'
      const finalTime = isNt ? null : Number(time)
      const levelEntered = parseInt(combo.current_level) || 0
      const levelAchieved = finalTime === null ? null : getLevel(game, finalTime)

      resultsToInsert.push({
        combo_id: combo.id,
        event_id: eventId,
        game: normalizedGame,
        time: finalTime,
        is_nt: isNt,
        level_entered: levelEntered,
        level_achieved: levelAchieved,
        penalties: 0,
      })

      if (finalTime !== null && !Number.isNaN(finalTime)) {
        const existingBest = pbBestByGame[normalizedGame]
        pbBestByGame[normalizedGame] = existingBest == null
          ? finalTime
          : Math.min(existingBest, finalTime)
      }
    })

    const { error: resultsError } = await supabase
      .from('qualifier_results')
      .insert(resultsToInsert)

    if (resultsError) throw resultsError

    const pbGames = Object.keys(pbBestByGame)
    let pbUpdates = []

    if (pbGames.length > 0) {
      const { data: existingPbs, error: existingPbError } = await supabase
        .from('personal_bests')
        .select('id, game, best_time')
        .eq('combo_id', combo.id)
        .eq('season_year', year)
        .in('game', pbGames)

      if (existingPbError) throw existingPbError

      const existingByGame = (existingPbs || []).reduce((acc, row) => {
        acc[row.game] = row.best_time
        return acc
      }, {})

      const achievedAt = new Date(`${year}-12-31T00:00:00.000Z`).toISOString()
      pbUpdates = pbGames
        .filter(game => {
          const bestTime = pbBestByGame[game]
          const existingBest = existingByGame[game]
          return existingBest == null || bestTime < existingBest
        })
        .map(game => ({
          combo_id: combo.id,
          game,
          best_time: pbBestByGame[game],
          season_year: year,
          achieved_at: achievedAt,
          updated_at: new Date().toISOString(),
        }))
    }

    if (pbUpdates.length > 0) {
      const { error: pbError } = await supabase
        .from('personal_bests')
        .upsert(pbUpdates, {
          onConflict: 'combo_id,game,season_year',
          ignoreDuplicates: false,
        })

      if (pbError) throw pbError
    }

    return {
      insertedCount: resultsToInsert.length,
      pbUpdatesCount: pbUpdates.length
    }
  }

  function handleHistoricalManualChange(game, field, value) {
    setHistoricalManualEntries(prev => ({
      ...prev,
      [game]: {
        ...prev[game],
        [field]: value
      }
    }))
  }

  function toggleHistoricalManualNT(game) {
    setHistoricalManualEntries(prev => ({
      ...prev,
      [game]: {
        ...prev[game],
        is_nt: !prev[game].is_nt,
        time: ''
      }
    }))
  }

  function handleHistoricalPdfChange(game, field, value) {
    setHistoricalPdfEntries(prev => ({
      ...prev,
      [game]: {
        ...prev[game],
        [field]: value
      }
    }))
  }

  function toggleHistoricalPdfNT(game) {
    setHistoricalPdfEntries(prev => ({
      ...prev,
      [game]: {
        ...prev[game],
        is_nt: !prev[game].is_nt,
        time: ''
      }
    }))
  }

  async function handleHistoricalPdfSave() {
    if (!historicalComboId) {
      toast.error('Please select a horse/rider combo for historical import')
      return
    }

    const qualifierNumber = Number(historicalPdfQualifierNumber)
    if (!qualifierNumber || !QUALIFIER_GAMES[qualifierNumber]) {
      toast.error('Enter a valid qualifier number')
      return
    }

    if (!historicalPdfVenue.trim()) {
      toast.error('Please enter a venue for this PDF import')
      return
    }

    const selectedHistoricalCombo = combos.find(c => c.id === historicalComboId)
    if (!selectedHistoricalCombo) {
      toast.error('Selected combo could not be found')
      return
    }

    const historicalResults = Object.entries(historicalPdfEntries)
      .filter(([, entry]) => entry.is_nt || (entry.time && !Number.isNaN(Number(entry.time))))
      .map(([game, entry]) => ({
        game,
        time: entry.is_nt ? 'NT' : Number(entry.time)
      }))

    if (historicalResults.length === 0) {
      toast.error('Upload a PDF first or enter at least one game time')
      return
    }

    setSavingHistoricalPdf(true)
    toast.loading('Saving verified PDF results...')
    try {
      const { insertedCount, pbUpdatesCount } = await saveHistoricalResults({
        combo: selectedHistoricalCombo,
        year: historicalYear,
        historicalResults,
        eventMeta: {
          venue: historicalPdfVenue.trim(),
          province: effectiveProfile?.province || 'N/A',
          qualifierNumber,
          notes: `PDF historical import for Q${qualifierNumber} (${historicalYear})`
        }
      })
      toast.dismiss()
      toast.success(
        `Saved ${insertedCount} PDF result${insertedCount === 1 ? '' : 's'}. Updated ${pbUpdatesCount} PB${pbUpdatesCount === 1 ? '' : 's'}.`
      )
      fetchSavedSessions()
    } catch (error) {
      toast.dismiss()
      toast.error('Saving PDF import failed')
      console.error(error)
    } finally {
      setSavingHistoricalPdf(false)
    }
  }

  async function handleHistoricalManualSave() {
    if (!historicalComboId) {
      toast.error('Please select a horse/rider combo for historical import')
      return
    }

    const qualifierNumber = Number(historicalManualQualifierNumber)
    if (!qualifierNumber || !QUALIFIER_GAMES[qualifierNumber]) {
      toast.error('Enter a valid qualifier number to load games')
      return
    }

    if (!historicalManualVenue.trim()) {
      toast.error('Please enter a venue for this manual historical import')
      return
    }

    if (!historicalManualProvince) {
      toast.error('Please select a province for this manual historical import')
      return
    }

    const selectedHistoricalCombo = combos.find(c => c.id === historicalComboId)
    if (!selectedHistoricalCombo) {
      toast.error('Selected combo could not be found')
      return
    }

    const historicalResults = Object.entries(historicalManualEntries)
      .filter(([, entry]) => entry.is_nt || (entry.time && !Number.isNaN(Number(entry.time))))
      .map(([game, entry]) => ({
        game,
        time: entry.is_nt ? 'NT' : Number(entry.time)
      }))

    if (historicalResults.length === 0) {
      toast.error('Enter at least one manual time or NT result')
      return
    }

    setSavingHistoricalManual(true)
    toast.loading('Saving historical manual results...')
    try {
      const { insertedCount, pbUpdatesCount } = await saveHistoricalResults({
        combo: selectedHistoricalCombo,
        year: historicalYear,
        historicalResults,
        eventMeta: {
          venue: historicalManualVenue.trim(),
          province: historicalManualProvince,
          qualifierNumber,
          notes: `Manual historical import for Q${qualifierNumber} (${historicalYear})`
        }
      })
      toast.dismiss()
      toast.success(
        `Saved ${insertedCount} manual result${insertedCount === 1 ? '' : 's'}. Updated ${pbUpdatesCount} PB${pbUpdatesCount === 1 ? '' : 's'}.`
      )
      fetchSavedSessions()
    } catch (error) {
      toast.dismiss()
      toast.error('Manual historical save failed')
      console.error(error)
    } finally {
      setSavingHistoricalManual(false)
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
      const pageCanonical = canonicalizeGameLabel(pageNorm)
      for (const game of gameList) {
        const g = normalize(game)
        const gameCanonical = canonicalizeGameLabel(game)
        const normalizedGameCanonical = canonicalizeGameLabel(normalizeGameName(game))
        if (
          (g && pageNorm.includes(g)) ||
          (gameCanonical && pageCanonical.includes(gameCanonical)) ||
          (normalizedGameCanonical && pageCanonical.includes(normalizedGameCanonical))
        ) {
          return game
        }
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
    if (isNaN(time)) return null
    return time
  }

  function getEnteredLevel() {
    return parseInt(selectedCombo?.current_level) || 0
  }

  function getLiveLevel(game) {
    const finalTime = getFinalTime(game)
    if (finalTime === null) return null
    return getLevel(game, finalTime)
  }

  function getLiveOvercount(game) {
    if (!gameEntries[game]) return 0
    const levelEntered = getEnteredLevel()
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
          level_entered: getEnteredLevel(),
          level_achieved: levelAchieved,
          penalties: 0
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

        // Send notification for new PBs to the rider whose times were entered
        if (effectiveUserId) {
          await supabase.from('notifications').insert({
            user_id: effectiveUserId,
            type: 'new_pb',
            message: `New personal best${pbUpdates.length > 1 ? 's' : ''} set for ${pbUpdates.map(p => p.game).join(', ')}!`,
            link: '/my-times'
          })
        }
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

  function handleStartEditingSession(session) {
    const entries = {}
    session.results.forEach(result => {
      entries[result.id] = {
        time: result.time == null ? '' : String(result.time),
        is_nt: result.is_nt
      }
    })
    setEditingSession(session.key)
    setEditingSessionEntries(entries)
  }

  function handleCancelEditingSession() {
    setEditingSession(null)
    setEditingSessionEntries({})
  }

  function handleSessionEditChange(resultId, field, value) {
    setEditingSessionEntries(prev => ({
      ...prev,
      [resultId]: {
        ...prev[resultId],
        [field]: value
      }
    }))
  }

  function toggleSessionEditNT(resultId) {
    setEditingSessionEntries(prev => ({
      ...prev,
      [resultId]: {
        ...prev[resultId],
        is_nt: !prev[resultId]?.is_nt,
        time: ''
      }
    }))
  }

  async function handleSaveSessionEdits(session) {
    const updates = session.results.map(result => {
      const edited = editingSessionEntries[result.id]
      const isNt = Boolean(edited?.is_nt)
      const parsedTime = edited?.time != null && edited.time !== '' ? Number(edited.time) : null
      return {
        id: result.id,
        is_nt: isNt,
        time: isNt ? null : (Number.isNaN(parsedTime) ? null : parsedTime),
        level_achieved: isNt || Number.isNaN(parsedTime) || parsedTime == null
          ? null
          : getLevel(result.game, parsedTime)
      }
    })

    try {
      const updatePromises = updates.map(update =>
        supabase
          .from('qualifier_results')
          .update({
            is_nt: update.is_nt,
            time: update.time,
            level_achieved: update.level_achieved
          })
          .eq('id', update.id)
      )

      const results = await Promise.all(updatePromises)
      const failedUpdate = results.find(r => r.error)
      if (failedUpdate?.error) throw failedUpdate.error

      const seasonYear = session.event?.date
        ? new Date(session.event.date).getFullYear()
        : CURRENT_YEAR
      const affectedGames = [...new Set(session.results.map(r => normalizeGameName(r.game)).filter(Boolean))]

      if (affectedGames.length > 0) {
        const { data: yearEvents, error: yearEventsError } = await supabase
          .from('qualifier_events')
          .select('id')
          .gte('date', `${seasonYear}-01-01`)
          .lte('date', `${seasonYear}-12-31`)

        if (yearEventsError) throw yearEventsError
        const yearEventIds = yearEvents?.map(e => e.id) || []

        if (yearEventIds.length > 0) {
          const { data: seasonResults, error: seasonResultsError } = await supabase
            .from('qualifier_results')
            .select(`
              game,
              time,
              is_nt,
              qualifier_events (date)
            `)
            .eq('combo_id', session.combo_id)
            .in('event_id', yearEventIds)
            .in('game', affectedGames)

          if (seasonResultsError) throw seasonResultsError

          const bestByGame = {}
          ;(seasonResults || []).forEach(row => {
            if (row.is_nt || row.time == null) return
            const game = normalizeGameName(row.game)
            if (!game) return
            const bestTime = Number(row.time)
            if (Number.isNaN(bestTime)) return

            const existing = bestByGame[game]
            if (!existing || bestTime < existing.best_time) {
              const eventDate = row.qualifier_events?.date
              bestByGame[game] = {
                combo_id: session.combo_id,
                game,
                best_time: bestTime,
                season_year: seasonYear,
                achieved_at: eventDate ? `${eventDate}T00:00:00.000Z` : new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            }
          })

          // Always clear existing PB rows first so stale/duplicate rows
          // cannot keep an old incorrect "best" time alive.
          const { error: pbDeleteError } = await supabase
            .from('personal_bests')
            .delete()
            .eq('combo_id', session.combo_id)
            .eq('season_year', seasonYear)
            .in('game', affectedGames)

          if (pbDeleteError) throw pbDeleteError

          const pbRows = Object.values(bestByGame)
          if (pbRows.length > 0) {
            const { error: pbInsertError } = await supabase
              .from('personal_bests')
              .insert(pbRows)
            if (pbInsertError) throw pbInsertError
          }
        }
      }

      toast.success('Session updated')
      handleCancelEditingSession()
      fetchSavedSessions()
    } catch (error) {
      toast.error(error?.message ? `Error updating session: ${error.message}` : 'Error updating session')
      console.error(error)
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
          data-tour="tracker-enter-times"
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
        <button
          onClick={() => setActiveTab('historical')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'historical'
              ? 'border-green-700 text-green-800'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Historical Upload
        </button>
      </div>

      {/* Enter times tab */}
      {activeTab === 'enter' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-900">Quick flow: Event → Combo → Times</p>
            <p className="text-xs text-green-800 mt-1">
              Only past qualifiers from {CURRENT_YEAR} are shown. Use search to find a venue, province, or qualifier number faster.
            </p>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { num: 1, label: 'Select event' },
              { num: 2, label: 'Select combo' },
              { num: 3, label: 'Enter times' }
            ].map(({ num, label }) => (
              <div key={num} className="flex items-center gap-2 min-w-fit">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                  step > num
                    ? 'bg-green-600 text-white'
                    : step === num
                    ? 'bg-green-100 text-green-700 ring-2 ring-green-600'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > num ? <Check size={16} /> : num}
                </div>
                <span className={`text-sm ${
                  step === num ? 'text-green-700 font-semibold' : 'text-gray-500'
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
              {selectedCombo && (
                <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-600">
                    Bookmarks for <span className="font-semibold text-gray-800">{selectedCombo.horse_name}</span>
                  </p>
                  <button
                    onClick={() => setShowBookmarkedOnly(prev => !prev)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                      showBookmarkedOnly
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Star size={12} className={showBookmarkedOnly ? 'fill-current' : ''} />
                    {showBookmarkedOnly ? 'Showing bookmarked only' : 'Show bookmarked only'}
                  </button>
                </div>
              )}

              {(() => {
                const q = eventSearch.trim().toLowerCase()
                const searched = q
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
                const filtered = showBookmarkedOnly && selectedCombo
                  ? searched.filter(event => isQualifierBookmarked(selectedCombo.id, event.id))
                  : searched
                const resultLabel = `${filtered.length} event${filtered.length === 1 ? '' : 's'} available`

                if (events.length === 0) return (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                    No past events found yet. Events will appear here after they have been added by the admin.
                  </div>
                )
                if (filtered.length === 0) return (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                    No events match <strong>"{eventSearch}"</strong>. Try a different keyword.
                  </div>
                )
                return (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">{resultLabel}</p>
                  {filtered.map(event => (
                    <div
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleEventSelect(event)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleEventSelect(event)
                        }
                      }}
                      className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-green-400 hover:bg-green-50 transition group cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
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
                            {selectedCombo && isQualifierBookmarked(selectedCombo.id, event.id) && (
                              <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                <Star size={11} className="fill-current" />
                                Bookmarked
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={e => openBookmarkComboPicker(event, e)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-400 hover:text-yellow-600 hover:border-yellow-300 transition"
                            title="Bookmark this qualifier for a horse/rider combo"
                          >
                            <Star size={14} />
                          </button>
                          <ChevronDown size={20} className="text-gray-300 -rotate-90 group-hover:text-green-500 transition" />
                        </div>
                      </div>
                    </div>
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs uppercase tracking-wide text-green-700 font-semibold">Selected Event</p>
                <p className="text-sm text-green-800 mt-1">
                  {selectedEvent?.venue}, {selectedEvent?.province} ·{' '}
                  {new Date(selectedEvent?.date).toLocaleDateString()} ·{' '}
                  Q{selectedEvent?.qualifier_number}
                </p>
              </div>

              {combos.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                  No horse/rider combos found. Add one in your profile first.
                </div>
              ) : (
                <div className="space-y-2">
                  {combos.map(combo => (
                    <div
                      key={combo.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleComboSelect(combo)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleComboSelect(combo)
                        }
                      }}
                      className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-green-400 hover:bg-green-50 transition group cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
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
                            <div className="flex items-center gap-2 mt-1">
                              {combo.is_pinned && (
                                <span className="text-[11px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Pinned</span>
                              )}
                              {selectedEvent && isQualifierBookmarked(combo.id, selectedEvent.id) && (
                                <span className="text-[11px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                  Qualifier bookmarked
                                </span>
                              )}
                              <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                Level L{parseInt(combo.current_level) || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedEvent && (
                            <button
                              onClick={e => openBookmarkComboPicker(selectedEvent, e)}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition ${
                                isQualifierBookmarked(combo.id, selectedEvent.id)
                                  ? 'text-yellow-600 border-yellow-300 bg-yellow-50 hover:bg-yellow-100'
                                  : 'text-gray-400 border-gray-200 bg-white hover:text-yellow-600 hover:border-yellow-300'
                              }`}
                              title="Choose combo and bookmark qualifier"
                            >
                              <Star size={15} className={isQualifierBookmarked(combo.id, selectedEvent.id) ? 'fill-current' : ''} />
                            </button>
                          )}
                          <ChevronDown size={20} className="text-gray-300 -rotate-90 group-hover:text-green-500 transition" />
                        </div>
                      </div>
                    </div>
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-medium">{selectedCombo?.horse_name}</span>
                  {' · '}
                  {selectedEvent?.venue}, {selectedEvent?.province}
                  {' · '}
                  {new Date(selectedEvent?.date).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => openBookmarkComboPicker(selectedEvent, e)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                      selectedCombo && selectedEvent && isQualifierBookmarked(selectedCombo.id, selectedEvent.id)
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Star
                      size={12}
                      className={selectedCombo && selectedEvent && isQualifierBookmarked(selectedCombo.id, selectedEvent.id) ? 'fill-current' : ''}
                    />
                    {selectedCombo && selectedEvent && isQualifierBookmarked(selectedCombo.id, selectedEvent.id)
                      ? 'Bookmarked'
                      : 'Bookmark qualifier'}
                  </button>
                  <div className="font-bold">
                    Total overcount: {getTotalOvercount()}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Entered level is locked to this horse&apos;s signed-up level (L{getEnteredLevel()}).
              </p>

              {/* PDF upload */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">Upload scoresheet (optional)</p>
                  <p className="text-sm text-gray-500">
                    Upload your PDF to auto-fill the times, or enter them manually below.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="scoresheet-upload-input"
                    aria-disabled={processingPDF}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white h-10 px-4 text-sm bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 aria-disabled:opacity-50 aria-disabled:pointer-events-none"
                  >
                    <Upload size={16} />
                    {processingPDF ? 'Processing…' : 'Upload PDF'}
                  </label>
                  <input
                    id="scoresheet-upload-input"
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePDFUpload}
                    className="sr-only"
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

                      <div className="grid grid-cols-1 gap-3">
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
                className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <Check size={18} />
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEditingSession(session)}
                      className="p-2 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition"
                      title="Edit qualifier"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {session.results.map(result => {
                    const isEditingCurrentSession = editingSession === session.key
                    const editEntry = editingSessionEntries[result.id]
                    const viewIsNt = isEditingCurrentSession ? Boolean(editEntry?.is_nt) : result.is_nt
                    const viewTime = isEditingCurrentSession
                      ? (viewIsNt ? null : (editEntry?.time ? Number(editEntry.time) : null))
                      : result.time
                    const level = viewIsNt || viewTime == null || Number.isNaN(viewTime) ? null : getLevel(result.game, viewTime)
                    return (
                      <div key={result.id} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-gray-700">{result.game}</span>
                        {isEditingCurrentSession ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.001"
                              value={editEntry?.time || ''}
                              onChange={e => handleSessionEditChange(result.id, 'time', e.target.value)}
                              disabled={Boolean(editEntry?.is_nt)}
                              className="w-28 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400"
                              placeholder="22.724"
                            />
                            <button
                              onClick={() => toggleSessionEditNT(result.id)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg transition ${
                                editEntry?.is_nt
                                  ? 'bg-red-100 text-red-700 font-medium'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {editEntry?.is_nt ? 'NT' : 'Mark NT'}
                            </button>
                            {level !== null && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_STYLES[level]}`}>
                                L{level}
                              </span>
                            )}
                          </div>
                        ) : (
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
                        )}
                      </div>
                    )
                  })}
                </div>
                {editingSession === session.key && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
                    <button
                      onClick={handleCancelEditingSession}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveSessionEdits(session)}
                      className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Historical upload tab */}
      {activeTab === 'historical' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div>
              <p className="font-semibold text-gray-800">Import historical times & PBs</p>
              <p className="text-sm text-gray-500">
                Upload one or more previous-year scoresheet PDFs. We will save times and recalculate PBs for that season.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setHistoricalMethod('pdf')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  historicalMethod === 'pdf'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                PDF Import
              </button>
              <button
                onClick={() => setHistoricalMethod('manual')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  historicalMethod === 'manual'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Manual Entry
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Historical season</label>
                <select
                  value={historicalYear}
                  onChange={e => setHistoricalYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  {buildHistoricalYearOptions().map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Horse/rider combo</label>
                <select
                  value={historicalComboId}
                  onChange={e => setHistoricalComboId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">Select combo</option>
                  {combos.map(combo => (
                    <option key={combo.id} value={combo.id}>
                      {combo.horse_name}
                    </option>
                  ))}
                </select>
              </div>

              {historicalMethod === 'pdf' ? (
                <div className="flex items-end">
                  <label
                    htmlFor="historical-scoresheet-upload-input"
                    aria-disabled={processingHistoricalPDF || combos.length === 0}
                    className="w-full inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white h-10 px-4 text-sm bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 aria-disabled:opacity-50 aria-disabled:pointer-events-none"
                  >
                    <Upload size={16} />
                    {processingHistoricalPDF ? 'Importing…' : 'Upload historical PDFs'}
                  </label>
                  <input
                    id="historical-scoresheet-upload-input"
                    ref={historicalPdfInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={handleHistoricalPDFUpload}
                    className="sr-only"
                  />
                </div>
              ) : (
                <div className="flex items-end">
                  <button
                    onClick={handleHistoricalManualSave}
                    disabled={savingHistoricalManual || combos.length === 0}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white h-10 px-4 text-sm bg-green-600 text-white hover:bg-green-700"
                  >
                    <Save size={16} />
                    {savingHistoricalManual ? 'Saving…' : 'Save manual historical results'}
                  </button>
                </div>
              )}
            </div>

            {historicalMethod === 'pdf' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Qualifier number</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={historicalPdfQualifierNumber}
                      onChange={e => setHistoricalPdfQualifierNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Venue</label>
                    <input
                      type="text"
                      value={historicalPdfVenue}
                      onChange={e => setHistoricalPdfVenue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g. Bloem Showgrounds"
                    />
                  </div>
                </div>

                {(QUALIFIER_GAMES[Number(historicalPdfQualifierNumber)] || []).length > 0 && (
                  <p className="text-xs text-gray-500">
                    Q{Number(historicalPdfQualifierNumber)} games: {(QUALIFIER_GAMES[Number(historicalPdfQualifierNumber)] || []).join(', ')}
                  </p>
                )}

                {Object.keys(historicalPdfEntries).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(historicalPdfEntries).map(([game, entry]) => (
                      <div key={game} className="border border-gray-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-800 mb-2">{game}</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.001"
                            value={entry.time}
                            onChange={e => handleHistoricalPdfChange(game, 'time', e.target.value)}
                            disabled={entry.is_nt}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                            placeholder="e.g. 22.724"
                          />
                          <button
                            onClick={() => toggleHistoricalPdfNT(game)}
                            className={`text-xs px-2.5 py-2 rounded-lg transition ${
                              entry.is_nt
                                ? 'bg-red-100 text-red-700 font-medium'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {entry.is_nt ? 'NT' : 'Mark NT'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleHistoricalPdfSave}
                  disabled={savingHistoricalPdf || combos.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white h-10 px-4 text-sm bg-green-600 text-white hover:bg-green-700"
                >
                  <Save size={16} />
                  {savingHistoricalPdf ? 'Saving…' : 'Save verified PDF results'}
                </button>
              </div>
            )}

            {historicalMethod === 'manual' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Qualifier number</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={historicalManualQualifierNumber}
                      onChange={e => setHistoricalManualQualifierNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Venue</label>
                    <input
                      type="text"
                      value={historicalManualVenue}
                      onChange={e => setHistoricalManualVenue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g. Bloem Showgrounds"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Province</label>
                    <select
                      value={historicalManualProvince}
                      onChange={e => setHistoricalManualProvince(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value="">Select province</option>
                      {PROVINCES.map(province => (
                        <option key={province} value={province}>{province}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {Number(historicalManualQualifierNumber) > 0 && !QUALIFIER_GAMES[Number(historicalManualQualifierNumber)] && (
                  <p className="text-xs text-red-600">
                    Qualifier number must be between 1 and 12.
                  </p>
                )}

                {(QUALIFIER_GAMES[Number(historicalManualQualifierNumber)] || []).length > 0 && (
                  <p className="text-xs text-gray-500">
                    Q{Number(historicalManualQualifierNumber)} games: {(QUALIFIER_GAMES[Number(historicalManualQualifierNumber)] || []).join(', ')}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(historicalManualEntries).map(([game, entry]) => (
                  <div key={game} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-800 mb-2">{game}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.001"
                        value={entry.time}
                        onChange={e => handleHistoricalManualChange(game, 'time', e.target.value)}
                        disabled={entry.is_nt}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                        placeholder="e.g. 22.724"
                      />
                      <button
                        onClick={() => toggleHistoricalManualNT(game)}
                        className={`text-xs px-2.5 py-2 rounded-lg transition ${
                          entry.is_nt
                            ? 'bg-red-100 text-red-700 font-medium'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {entry.is_nt ? 'NT' : 'Mark NT'}
                      </button>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {bookmarkPickerEvent && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Bookmark qualifier</h3>
              <p className="text-sm text-gray-600 mt-1">
                Select which horse/rider combo this bookmark should be saved for.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {bookmarkPickerEvent.venue}, {bookmarkPickerEvent.province} · Q{bookmarkPickerEvent.qualifier_number}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Horse/rider combo</label>
              <select
                value={bookmarkPickerComboId}
                onChange={e => setBookmarkPickerComboId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select a combo</option>
                {combos.map(combo => (
                  <option key={combo.id} value={combo.id}>
                    {combo.horse_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setBookmarkPickerEvent(null)
                  setBookmarkPickerComboId('')
                }}
                className="px-3 py-2 rounded-lg text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmBookmarkComboSelection}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-green-700 hover:bg-green-800 transition"
              >
                Save bookmark
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
