import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { PROVINCES, QUALIFIER_GAMES, canonicalizeGameLabel, normalizeGameName } from '../../lib/constants'
import { getLevel } from '../../lib/matrix'
import {
  ChevronDown,
  Save,
  Plus,
  Check,
  X,
  Pencil,
  Trash2,
  Upload,
  ClipboardList,
  History,
  FolderOpen
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ConfirmDialog, PageHeader, Skeleton } from '../../components/ui'
import { useTabQueryParam } from '../../lib/useTabQueryParam'
import { fetchClubHeadRoster, fetchCombosForRider } from '../../lib/clubRiderRoster'

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
  const [events, setEvents] = useState([])
  const [combos, setCombos] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedCombo, setSelectedCombo] = useState(null)
  const [gameEntries, setGameEntries] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: null })
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
  const [eventProvinceFilter, setEventProvinceFilter] = useState('')
  const [historyHorseFilter, setHistoryHorseFilter] = useState('')
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

  const effectiveUserId = profile?.id
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
      const riderList = await fetchClubHeadRoster(profile.id)
      setLinkedRiders(riderList)
      if (riderList.length > 0) setSelectedRider(riderList[0])
      else setLoading(false)
    } catch {
      setLinkedRiders([])
      setLoading(false)
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
    if (isClubHead) {
      if (!selectedRider) return
      const data = await fetchCombosForRider(selectedRider)
      setCombos(data)
      return
    }
    if (!profile?.id) return
    const { data } = await supabase
      .from('horse_rider_combos')
      .select('*')
      .eq('user_id', profile.id)
      .is('managed_rider_id', null)
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

    let query = supabase
      .from('qualifier_results')
      .select(`
        *,
        qualifier_events (date, venue, province, qualifier_number),
        horse_rider_combos (horse_name)
      `)
      .in('event_id', yearEventIds)
      .order('created_at', { ascending: false })

    if (isClubHead) {
      if (!selectedRider) { setSavedSessions([]); return }
      const riderCombos = await fetchCombosForRider(selectedRider)
      const comboIds = riderCombos.map(c => c.id)
      if (comboIds.length === 0) { setSavedSessions([]); return }
      query = query.in('combo_id', comboIds)
    } else {
      if (!profile?.id) { setSavedSessions([]); return }
      query = query.eq('horse_rider_combos.user_id', profile.id)
    }

    const { data } = await query

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
      const pageCanonicalCompacted = pageCanonical.replace(/\s+/g, '')
      for (const game of gameList) {
        const g = normalize(game)
        const gameCanonical = canonicalizeGameLabel(game)
        const normalizedGameCanonical = canonicalizeGameLabel(normalizeGameName(game))
        const gameCanonicalCompacted = gameCanonical.replace(/\s+/g, '')
        const normalizedGameCanonicalCompacted = normalizedGameCanonical.replace(/\s+/g, '')
        if (
          (g && pageNorm.includes(g)) ||
          (gameCanonical && pageCanonical.includes(gameCanonical)) ||
          (normalizedGameCanonical && pageCanonical.includes(normalizedGameCanonical)) ||
          (gameCanonicalCompacted && pageCanonicalCompacted.includes(gameCanonicalCompacted)) ||
          (
            normalizedGameCanonicalCompacted &&
            pageCanonicalCompacted.includes(normalizedGameCanonicalCompacted)
          )
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

    // Fallback: map extracted times in order to the qualifier's games list.
    // This also fills gaps when only some game labels were recognized.
    if (extractedInOrder.length > 0) {
      const picked = extractedInOrder.map(x => x.time).slice(0, gameList.length)
      picked.forEach((t, idx) => {
        const targetGame = gameList[idx]
        if (!targetGame) return
        if (times[targetGame] == null) {
          times[targetGame] = t
        }
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
      setSelectedEvent(null)
      setSelectedCombo(null)
      setGameEntries({})
      setEventProvinceFilter('')
      fetchSavedSessions()

    } catch (error) {
      toast.error('Error saving times')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  function handleDeleteSession(session) {
    setConfirmDialog({
      open: true,
      title: 'Delete session?',
      description: 'All results for this session will be permanently deleted.',
      onConfirm: async () => {
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
      },
    })
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
                      setSelectedEvent(null)
                      setSelectedCombo(null)
                      setGameEntries({})
                      setEventProvinceFilter('')
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

      {/* Mobile tab grid */}
      {(() => {
        const sections = [
          { id: 'enter',      label: 'Enter Times',       icon: ClipboardList, tourAttr: 'tracker-enter-times' },
          { id: 'history',    label: 'Session History',   icon: History },
          { id: 'historical', label: 'Historical Upload', icon: FolderOpen },
        ]
        return (
          <div className="grid grid-cols-3 gap-2 md:hidden">
            {sections.map(({ id, label, icon: Icon, tourAttr }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  data-tour={tourAttr}
                  onClick={() => setActiveTab(id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 text-xs font-semibold transition ${
                    active
                      ? 'bg-green-700 border-green-700 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700'
                  }`}
                >
                  <Icon size={20} />
                  {label}
                </button>
              )
            })}
          </div>
        )
      })()}

      {/* Desktop sidebar + content */}
      <div className="flex gap-5 items-start">

        {/* Desktop sidebar */}
        {(() => {
          const sections = [
            { id: 'enter',      label: 'Enter Times',       icon: ClipboardList, tourAttr: 'tracker-enter-times' },
            { id: 'history',    label: 'Session History',   icon: History },
            { id: 'historical', label: 'Historical Upload', icon: FolderOpen },
          ]
          return (
            <nav className="hidden md:flex flex-col gap-1 flex-shrink-0 w-44 bg-white rounded-xl border border-gray-200 p-2">
              {sections.map(({ id, label, icon: Icon, tourAttr }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    data-tour={tourAttr}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition text-left ${
                      active
                        ? 'bg-green-700 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    {label}
                  </button>
                )
              })}
            </nav>
          )
        })()}

        {/* Tab panels */}
        <div className="flex-1 min-w-0">

      {/* Enter times tab — single screen */}
      {activeTab === 'enter' && (
        <div className="space-y-4">

          {/* Selection bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Province filter */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Province</label>
                <div className="relative">
                  <select
                    value={eventProvinceFilter}
                    onChange={e => {
                      setEventProvinceFilter(e.target.value)
                      setSelectedEvent(null)
                      setGameEntries({})
                    }}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-gray-700"
                  >
                    <option value="">All provinces</option>
                    {[...new Set(events.map(e => e.province).filter(Boolean))].sort().map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Event dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Event</label>
                <div className="relative">
                  <select
                    value={selectedEvent?.id || ''}
                    onChange={e => {
                      const ev = events.find(x => x.id === e.target.value) || null
                      setSelectedEvent(ev)
                      if (ev) initGameEntries(ev)
                      else setGameEntries({})
                    }}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-gray-700"
                  >
                    <option value="">Select event…</option>
                    {(eventProvinceFilter ? events.filter(e => e.province === eventProvinceFilter) : events).map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.qualifier_number ? `Q${ev.qualifier_number} · ` : ''}{ev.venue} · {new Date(ev.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Combo dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Horse / Rider</label>
                <div className="relative">
                  <select
                    value={selectedCombo?.id || ''}
                    onChange={e => {
                      const combo = combos.find(c => c.id === e.target.value) || null
                      setSelectedCombo(combo)
                      if (combo) setHistoricalComboId(combo.id)
                    }}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-gray-700"
                  >
                    <option value="">Select horse…</option>
                    {combos.map(c => (
                      <option key={c.id} value={c.id}>{c.horse_name} · L{parseInt(c.current_level) || 0}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Event detail hint */}
            {selectedEvent && (
              <p className="text-xs text-gray-500">
                {selectedEvent.venue}, {selectedEvent.province} · {new Date(selectedEvent.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                {selectedEvent.qualifier_number && ` · Games: ${QUALIFIER_GAMES[selectedEvent.qualifier_number]?.join(', ')}`}
              </p>
            )}
          </div>

          {/* Scorecard — appears once both are chosen */}
          {selectedEvent && selectedCombo && Object.keys(gameEntries).length > 0 && (
            <div className="space-y-3">
              {/* PDF upload */}
              <div className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">Auto-fill from PDF</p>
                  <p className="text-xs text-gray-500">Upload your scoresheet to fill times automatically.</p>
                </div>
                <label
                  htmlFor="scoresheet-upload-input"
                  aria-disabled={processingPDF}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition aria-disabled:opacity-50 aria-disabled:pointer-events-none flex-shrink-0"
                >
                  <Upload size={15} />
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

              {/* Scorecard */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {selectedCombo.horse_name} · L{getEnteredLevel()} entered · Q{selectedEvent.qualifier_number}
                  </p>
                </div>

                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-4 py-2 border-b border-gray-100 bg-gray-50/60">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Game</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-28 text-center">Time (s)</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-14 text-center">Level</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-14 text-center">NT</span>
                </div>

                <div className="divide-y divide-gray-100">
                  {Object.entries(gameEntries).map(([game, entry]) => {
                    const liveLevel = getLiveLevel(game)
                    const overcount = getLiveOvercount(game)
                    return (
                      <div
                        key={game}
                        className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-4 py-2.5 transition ${entry.is_nt ? 'bg-red-50' : overcount > 0 ? 'bg-yellow-50' : ''}`}
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-800">{game}</span>
                          {overcount > 0 && (
                            <span className="ml-2 text-[10px] font-bold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded-full">+{overcount}</span>
                          )}
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={entry.time}
                          onChange={e => handleTimeChange(game, 'time', e.target.value)}
                          disabled={entry.is_nt}
                          className="w-28 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
                          placeholder="22.724"
                        />
                        <div className="w-14 flex justify-center">
                          {liveLevel !== null && !entry.is_nt ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${LEVEL_STYLES[liveLevel]}`}>L{liveLevel}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                        <div className="w-14 flex justify-center">
                          <button
                            onClick={() => toggleNT(game)}
                            className={`w-10 h-7 rounded-lg text-xs font-bold transition ${entry.is_nt ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}
                          >
                            NT
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total overcount</span>
                  <span className={`text-lg font-bold ${getTotalOvercount() > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
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
                {saving ? 'Saving…' : 'Save Times'}
              </button>
            </div>
          )}

          {/* Placeholder when not yet selected */}
          {(!selectedEvent || !selectedCombo) && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
              <p className="text-sm">Select an event and horse above to start entering times.</p>
            </div>
          )}
        </div>
      )}

      {/* Session history tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Horse:</span>
              <div className="relative inline-block">
                <select
                  value={historyHorseFilter}
                  onChange={e => setHistoryHorseFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white font-medium"
                >
                  <option value="">All horses</option>
                  {combos.map(c => (
                    <option key={c.id} value={c.id}>{c.horse_name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {(() => {
            const filteredSessions = historyHorseFilter
              ? savedSessions.filter(s => s.horse?.id === historyHorseFilter)
              : savedSessions
            return filteredSessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No sessions saved for {selectedYear}. Enter your qualifier times to get started.
            </div>
          ) : (
            filteredSessions.map(session => (
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

                {editingSession === session.key && (
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-4 py-2 border-b border-gray-100 bg-gray-50/60">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Game</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-28 text-center">Time (s)</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-14 text-center">Level</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-14 text-center">NT</span>
                  </div>
                )}
                <div className="divide-y divide-gray-100">
                  {session.results.map(result => {
                    const isEditingCurrentSession = editingSession === session.key
                    const editEntry = editingSessionEntries[result.id]
                    const viewIsNt = isEditingCurrentSession ? Boolean(editEntry?.is_nt) : result.is_nt
                    const viewTime = isEditingCurrentSession
                      ? (viewIsNt ? null : (editEntry?.time ? Number(editEntry.time) : null))
                      : result.time
                    const level = viewIsNt || viewTime == null || Number.isNaN(viewTime) ? null : getLevel(result.game, viewTime)
                    return isEditingCurrentSession ? (
                      <div key={result.id} className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-4 py-2.5 transition ${editEntry?.is_nt ? 'bg-red-50' : ''}`}>
                        <span className="text-sm font-medium text-gray-800">{result.game}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editEntry?.time || ''}
                          onChange={e => handleSessionEditChange(result.id, 'time', e.target.value)}
                          disabled={Boolean(editEntry?.is_nt)}
                          className="w-28 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
                          placeholder="22.724"
                        />
                        <div className="w-14 flex justify-center">
                          {level !== null ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${LEVEL_STYLES[level]}`}>L{level}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                        <div className="w-14 flex justify-center">
                          <button
                            onClick={() => toggleSessionEditNT(result.id)}
                            className={`w-10 h-7 rounded-lg text-xs font-bold transition ${
                              editEntry?.is_nt ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                            }`}
                          >
                            NT
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={result.id} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-gray-700">{result.game}</span>
                        <div className="flex items-center gap-2">
                          {result.is_nt ? (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">NT</span>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-gray-800">{result.time?.toFixed(3)}s</span>
                              {level !== null && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_STYLES[level]}`}>L{level}</span>
                              )}
                            </>
                          )}
                        </div>
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
          )
          })()}
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
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Game</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-28 text-center">Time (s)</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-14 text-center">NT</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {Object.entries(historicalPdfEntries).map(([game, entry]) => (
                        <div key={game} className={`grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-4 py-2.5 ${entry.is_nt ? 'bg-red-50' : ''}`}>
                          <span className="text-sm font-medium text-gray-800">{game}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={entry.time}
                            onChange={e => handleHistoricalPdfChange(game, 'time', e.target.value)}
                            disabled={entry.is_nt}
                            className="w-28 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:border-gray-200"
                            placeholder="22.724"
                          />
                          <div className="w-14 flex justify-center">
                            <button
                              onClick={() => toggleHistoricalPdfNT(game)}
                              className={`w-10 h-7 rounded-lg text-xs font-bold transition ${
                                entry.is_nt ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                              }`}
                            >
                              NT
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
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

                {Object.keys(historicalManualEntries).length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Game</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-28 text-center">Time (s)</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-14 text-center">NT</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {Object.entries(historicalManualEntries).map(([game, entry]) => (
                        <div key={game} className={`grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-4 py-2.5 ${entry.is_nt ? 'bg-red-50' : ''}`}>
                          <span className="text-sm font-medium text-gray-800">{game}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={entry.time}
                            onChange={e => handleHistoricalManualChange(game, 'time', e.target.value)}
                            disabled={entry.is_nt}
                            className="w-28 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:border-gray-200"
                            placeholder="22.724"
                          />
                          <div className="w-14 flex justify-center">
                            <button
                              onClick={() => toggleHistoricalManualNT(game)}
                              className={`w-10 h-7 rounded-lg text-xs font-bold transition ${
                                entry.is_nt ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                              }`}
                            >
                              NT
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

        </div> {/* end tab panels */}
      </div> {/* end sidebar + content flex */}

      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(d => ({ ...d, open: false }))}
        onConfirm={confirmDialog.onConfirm ?? (() => {})}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
