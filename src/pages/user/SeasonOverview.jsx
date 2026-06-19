import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { GAMES, QUALIFIER_GAMES, PROVINCES, normalizeGameName } from '../../lib/constants'
import { getLevel, getNationalsLevel } from '../../lib/matrix'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  MapPin,
  ChevronDown,
  Trophy,
  Target,
  ChevronRight,
  Zap
} from 'lucide-react'
import { EmptyState, PageHeader, Skeleton } from '../../components/ui'
import { fetchClubHeadRoster, fetchCombosForRider } from '../../lib/clubRiderRoster'

const CURRENT_YEAR = new Date().getFullYear()

function buildYearOptions() {
  const years = []
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 4; y--) years.push(y)
  return years
}

function getSeasonDates(year) {
  return {
    start: new Date(`${year}-01-01`),
    end: new Date(`${year}-10-05`)
  }
}

function buildCarryForwardPbTimeMap(rows) {
  const map = {}
  rows?.forEach(row => {
    const game = normalizeGameName(row.game)
    if (!game) return
    if (map[game] === undefined || row.best_time < map[game]) map[game] = row.best_time
  })
  return map
}

function buildSeasonCoveredGameSet(rows) {
  const covered = new Set()
  rows?.forEach(row => {
    if (row?.is_nt === true || !row?.game) return
    covered.add(normalizeGameName(row.game))
  })
  return covered
}

function buildYearBestsFromResults(rows) {
  const map = {}
  rows?.forEach(row => {
    if (row?.is_nt === true || !row?.game) return
    const game = normalizeGameName(row.game)
    const bestTime = Number.parseFloat(String(row.time).replace(',', '.'))
    if (!game || Number.isNaN(bestTime)) return
    const current = map[game]
    if (!current || bestTime < current.best_time) map[game] = { game, best_time: bestTime }
  })
  return map
}

function getMissingGamesAtEvent(event, missingGames) {
  if (!event.qualifier_number) return []
  return missingGames.filter(game => (QUALIFIER_GAMES[event.qualifier_number] || []).includes(game))
}

function getQualifiersForMissingGames(events, missingGames, { province, month, game, todayStart }) {
  if (missingGames.length === 0) return []
  const gamesToMatch = game === 'all' ? missingGames : missingGames.filter(g => g === game)
  if (gamesToMatch.length === 0) return []
  return events
    .filter(event => {
      if (!event.qualifier_number) return false
      const eventDate = new Date(event.date)
      eventDate.setHours(0, 0, 0, 0)
      if (eventDate < todayStart) return false
      if (getMissingGamesAtEvent(event, gamesToMatch).length === 0) return false
      if (province !== 'all' && event.province !== province) return false
      if (month !== 'all' && new Date(event.date).getMonth() !== Number(month)) return false
      return true
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
}

const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
}

const LEVEL_BG = {
  0: 'from-gray-500 to-gray-600',
  1: 'from-blue-500 to-blue-700',
  2: 'from-green-600 to-green-700',
  3: 'from-orange-500 to-orange-600',
  4: 'from-red-500 to-red-700',
}

function buildUpcomingMonthFilterOptions(selectedYear) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const options = [{ value: 'all', label: 'All months' }]
  if (selectedYear < currentYear) return options
  const startMonth = selectedYear === currentYear ? currentMonth : 0
  for (let month = startMonth; month <= 11; month++) {
    options.push({
      value: String(month),
      label: new Date(selectedYear, month, 1).toLocaleDateString('en-ZA', { month: 'long' }),
    })
  }
  return options
}

export default function SeasonOverview() {
  const { profile, isClubHead } = useAuth()
  const [combos, setCombos] = useState([])
  const [selectedCombo, setSelectedCombo] = useState(null)
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [attendedEvents, setAttendedEvents] = useState([])
  const [personalBests, setPersonalBests] = useState({})
  const [yearBests, setYearBests] = useState({})
  const [seasonCoveredGames, setSeasonCoveredGames] = useState(new Set())
  const [missingGamesProvinceFilter, setMissingGamesProvinceFilter] = useState('all')
  const [missingGamesMonthFilter, setMissingGamesMonthFilter] = useState('all')
  const [missingGamesGameFilter, setMissingGamesGameFilter] = useState('all')
  const [showFindQualifiers, setShowFindQualifiers] = useState(false)

  const [linkedRiders, setLinkedRiders] = useState([])
  const [selectedRider, setSelectedRider] = useState(null)
  const [loadingRiders, setLoadingRiders] = useState(false)

  useEffect(() => {
    if (!profile) return
    if (isClubHead) fetchLinkedRiders()
    else fetchData()
  }, [profile, selectedYear])

  useEffect(() => {
    if (isClubHead && selectedRider) fetchData()
  }, [selectedRider, selectedYear])

  useEffect(() => {
    if (selectedCombo) fetchComboData()
  }, [selectedCombo, selectedYear])

  const gamesMissingForFilter = GAMES.filter(game => !seasonCoveredGames.has(game))
  const upcomingMonthFilterOptions = buildUpcomingMonthFilterOptions(selectedYear)

  useEffect(() => {
    if (missingGamesGameFilter !== 'all' && !gamesMissingForFilter.includes(missingGamesGameFilter))
      setMissingGamesGameFilter('all')
  }, [gamesMissingForFilter, missingGamesGameFilter])

  useEffect(() => {
    if (missingGamesMonthFilter === 'all') return
    const validMonths = upcomingMonthFilterOptions.map(opt => opt.value)
    if (!validMonths.includes(missingGamesMonthFilter)) setMissingGamesMonthFilter('all')
  }, [upcomingMonthFilterOptions, missingGamesMonthFilter])

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

  async function fetchData() {
    setLoading(true)
    if (isClubHead && !selectedRider) { setLoading(false); return }
    if (!profile?.id) { setLoading(false); return }

    const yearStart = `${selectedYear}-01-01`
    const yearEnd = `${selectedYear}-12-31`

    let combosData = []
    if (isClubHead) {
      combosData = await fetchCombosForRider(selectedRider)
    } else {
      const res = await supabase
        .from('horse_rider_combos')
        .select('*')
        .eq('user_id', profile.id)
        .is('managed_rider_id', null)
        .eq('is_archived', false)
        .order('is_pinned', { ascending: false })
      combosData = res.data || []
    }

    const eventsRes = await supabase
      .from('qualifier_events')
      .select('*')
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .order('date', { ascending: true })

    setCombos(combosData)
    setEvents(eventsRes.data || [])
    if (combosData.length > 0) {
      setSelectedCombo(combosData.find(c => c.is_pinned) || combosData[0])
    } else {
      setSelectedCombo(null)
    }
    setLoading(false)
  }

  async function fetchComboData() {
    const yearStart = `${selectedYear}-01-01`
    const yearEnd = `${selectedYear}-12-31`

    const { data: yearEvents } = await supabase
      .from('qualifier_events')
      .select('id')
      .gte('date', yearStart)
      .lte('date', yearEnd)

    const yearEventIds = yearEvents?.map(e => e.id) || []

    const [resultsRes, pbsRes] = await Promise.all([
      yearEventIds.length > 0
        ? supabase
            .from('qualifier_results')
            .select('event_id, game, time, is_nt')
            .eq('combo_id', selectedCombo.id)
            .in('event_id', yearEventIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('personal_bests')
        .select('*')
        .eq('combo_id', selectedCombo.id)
        .lte('season_year', selectedYear)
    ])

    const uniqueEventIds = [...new Set(resultsRes.data?.map(r => r.event_id) || [])]
    setAttendedEvents(uniqueEventIds)

    const pbMap = buildCarryForwardPbTimeMap(pbsRes.data)
    setPersonalBests(pbMap)
    setSeasonCoveredGames(buildSeasonCoveredGameSet(resultsRes.data))
    setYearBests(buildYearBestsFromResults(resultsRes.data))
  }

  const gamesCovered = GAMES.filter(game => seasonCoveredGames.has(game))
  const gamesMissing = GAMES.filter(game => !seasonCoveredGames.has(game))

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const gamesToFind = missingGamesGameFilter === 'all'
    ? gamesMissing
    : gamesMissing.filter(g => g === missingGamesGameFilter)

  const qualifiersForMissingGames = getQualifiersForMissingGames(events, gamesMissing, {
    province: missingGamesProvinceFilter,
    month: missingGamesMonthFilter,
    game: missingGamesGameFilter,
    todayStart,
  })

  const qualifiersAttended = attendedEvents.length
  const hasMinQualifiers = qualifiersAttended >= 2
  const hasMinGames = gamesCovered.length >= 11

  const effectiveProvince = isClubHead ? selectedRider?.province : profile?.province
  const provinceQualifiersAttended = attendedEvents.filter(eventId => {
    const event = events.find(e => e.id === eventId)
    return event?.province === effectiveProvince
  }).length
  const hasMinProvinceQualifiers = provinceQualifiersAttended >= 2

  const isEligible = hasMinQualifiers && hasMinGames && hasMinProvinceQualifiers

  const nationalsLevel = getNationalsLevel(personalBests)

  const today = todayStart
  const { start: seasonStart, end: seasonEnd } = getSeasonDates(selectedYear)
  const totalDays = (seasonEnd - seasonStart) / (1000 * 60 * 60 * 24)
  const daysPassed = Math.min(Math.max((today - seasonStart) / (1000 * 60 * 60 * 24), 0), totalDays)
  const seasonProgress = Math.round((daysPassed / totalDays) * 100)

  const eligibilityItems = [
    {
      met: hasMinQualifiers,
      label: 'Minimum 2 qualifiers',
      detail: `${qualifiersAttended} attended`,
    },
    {
      met: hasMinProvinceQualifiers,
      label: `2 qualifiers in ${effectiveProvince || 'your province'}`,
      detail: `${provinceQualifiersAttended} province qualifiers`,
    },
    {
      met: hasMinGames,
      label: '11 of 13 games covered',
      detail: `${gamesCovered.length}/13 covered`,
    },
    {
      met: true,
      label: 'Account in good standing',
      detail: 'Approved',
    },
  ]
  const eligibilityMet = eligibilityItems.filter(i => i.met).length

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24" />
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
    </div>
  )

  if (combos.length === 0) return (
    <EmptyState
      title="No horses added yet"
      description="Go to your profile to add a horse/rider combo first."
      action={
        <a href="/profile" className="text-sm font-semibold text-green-800 hover:underline">
          Go to profile →
        </a>
      }
    />
  )

  return (
    <div>

      <div className="space-y-5 mb-0">
        <PageHeader
          title="Season Overview"
          description={isClubHead && selectedRider ? `${selectedYear} — ${selectedRider.rider_name}` : `${selectedYear} Season`}
          actions={
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
          }
        />

        {/* Club head rider selector */}
        {isClubHead && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {loadingRiders ? (
              <p className="text-sm text-gray-400">Loading riders…</p>
            ) : linkedRiders.length === 0 ? (
              <p className="text-sm text-gray-400">
                No riders linked.{' '}
                <a href="/my-club-riders" className="text-green-700 font-medium hover:underline">Go to My Riders →</a>
              </p>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rider:</span>
                <div className="flex gap-2 flex-wrap">
                  {linkedRiders.map(rider => (
                    <button
                      key={rider.id}
                      onClick={() => { setSelectedRider(rider); setSelectedCombo(null) }}
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
      </div>

      {/* ── Sticky horse selector — outside space-y so margin-top doesn't offset it ── */}
      <div className="sticky top-0 z-20 py-3 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm mt-5">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0">Horse:</span>
          <div className="flex gap-2 flex-nowrap">
            {combos.map(combo => {
              const active = selectedCombo?.id === combo.id
              const lvl = parseInt(combo.current_level) || 0
              return (
                <button
                  key={combo.id}
                  onClick={() => setSelectedCombo(combo)}
                  className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-sm font-semibold transition flex-shrink-0 border ${
                    active
                      ? 'bg-green-700 border-green-700 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                  }`}>
                    {combo.horse_name.charAt(0).toUpperCase()}
                  </span>
                  {combo.horse_name}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    L{lvl}
                  </span>
                  {combo.is_pinned && (
                    <span className={`text-[10px] ${active ? 'text-green-200' : 'text-yellow-500'}`}>★</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-5 mt-5">

      {/* ── Hero stats ──────────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${LEVEL_BG[nationalsLevel ?? 0]} rounded-2xl p-5 text-white shadow-lg`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
              Projected Nationals Level
            </p>
            <p className="text-5xl font-black tracking-tight">
              {nationalsLevel !== null ? `L${nationalsLevel}` : '—'}
            </p>
            <p className="text-white/60 text-xs mt-1">
              {selectedCombo?.horse_name} · {gamesCovered.length}/13 games · {selectedYear}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <Trophy size={36} className="text-white/30 mb-1" />
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              isEligible ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'
            }`}>
              {isEligible ? '✓ Eligible' : `${eligibilityMet}/4 criteria`}
            </span>
          </div>
        </div>

        {/* Season progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-white/60 mb-1.5">
            <span>Season start</span>
            <span className="font-semibold text-white">{seasonProgress}% through season</span>
            <span>Nationals</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-white h-2 rounded-full transition-all"
              style={{ width: `${seasonProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Quick stat row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill
          value={qualifiersAttended}
          label="Qualifiers"
          sub={hasMinQualifiers ? 'Min met ✓' : 'Need 2'}
          ok={hasMinQualifiers}
        />
        <StatPill
          value={`${gamesCovered.length}/13`}
          label="Games"
          sub={hasMinGames ? 'Min met ✓' : `Need ${11 - gamesCovered.length} more`}
          ok={hasMinGames}
        />
        <StatPill
          value={provinceQualifiersAttended}
          label="Province Q's"
          sub={hasMinProvinceQualifiers ? 'Min met ✓' : 'Need 2'}
          ok={hasMinProvinceQualifiers}
        />
      </div>

      {/* ── Eligibility checklist ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={17} className="text-green-600" />
            <h2 className="font-semibold text-gray-800">Nationals Eligibility</h2>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            isEligible ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {eligibilityMet}/4 criteria
          </span>
        </div>

        <div className="divide-y divide-gray-50">
          {eligibilityItems.map((item, i) => (
            <div key={i} className={`flex items-center gap-3 px-5 py-3 ${item.met ? '' : 'bg-yellow-50/50'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                item.met ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                {item.met
                  ? <CheckCircle size={16} className="text-green-600" />
                  : <AlertCircle size={16} className="text-yellow-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.met ? 'text-gray-800' : 'text-yellow-800'}`}>{item.label}</p>
                <p className={`text-xs ${item.met ? 'text-gray-400' : 'text-yellow-600'}`}>{item.detail}</p>
              </div>
              {item.met && <span className="text-green-500 text-sm">✓</span>}
            </div>
          ))}
        </div>

        {isEligible && (
          <div className="px-5 py-3 bg-green-50 border-t border-green-100 flex items-center gap-2">
            <Zap size={15} className="text-green-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-green-700">You're on track for Nationals!</p>
          </div>
        )}
      </div>

      {/* ── Games grid ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Game Coverage</h2>
          <span className="text-xs font-semibold text-gray-500">
            {gamesCovered.length} <span className="text-gray-300">/</span> 13
          </span>
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3 pb-1">
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${(gamesCovered.length / 13) * 100}%` }}
            />
          </div>
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {GAMES.map(game => {
            const covered = seasonCoveredGames.has(game)
            const yearBest = yearBests[game]
            const level = yearBest ? getLevel(game, yearBest.best_time) : null

            return (
              <div
                key={game}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border transition ${
                  covered
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  covered ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  {covered
                    ? <CheckCircle size={13} className="text-white" />
                    : <XCircle size={13} className="text-white" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${covered ? 'text-gray-800' : 'text-gray-400'}`}>{game}</p>
                  {covered && yearBest && (
                    <p className="text-[10px] text-gray-500 font-mono">{yearBest.best_time.toFixed(3)}s</p>
                  )}
                </div>
                {covered && level !== null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${LEVEL_STYLES[level]}`}>
                    L{level}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Find qualifiers for missing games ───────────────────────────────── */}
      {gamesMissing.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowFindQualifiers(prev => !prev)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              <Calendar size={17} className="text-green-600" />
              <span className="font-semibold text-gray-800">Find qualifiers for missing games</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {gamesMissing.length} game{gamesMissing.length !== 1 ? 's' : ''} needed
              </span>
            </div>
            <ChevronRight
              size={16}
              className={`text-gray-400 transition-transform ${showFindQualifiers ? 'rotate-90' : ''}`}
            />
          </button>

          {showFindQualifiers && (
            <div className="border-t border-gray-100 p-5 space-y-4">
              {/* Missing games chips */}
              <div className="flex flex-wrap gap-1.5">
                {gamesMissing.map(game => (
                  <span
                    key={game}
                    onClick={() => setMissingGamesGameFilter(missingGamesGameFilter === game ? 'all' : game)}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer transition border ${
                      missingGamesGameFilter === game
                        ? 'bg-amber-100 border-amber-300 text-amber-800'
                        : 'bg-gray-100 border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700'
                    }`}
                  >
                    <XCircle size={11} className="opacity-60" />
                    {game}
                  </span>
                ))}
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Province</label>
                  <div className="relative">
                    <select
                      value={missingGamesProvinceFilter}
                      onChange={e => setMissingGamesProvinceFilter(e.target.value)}
                      className="appearance-none w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
                    >
                      <option value="all">All provinces</option>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
                  <div className="relative">
                    <select
                      value={missingGamesMonthFilter}
                      onChange={e => setMissingGamesMonthFilter(e.target.value)}
                      className="appearance-none w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
                    >
                      {upcomingMonthFilterOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Game</label>
                  <div className="relative">
                    <select
                      value={missingGamesGameFilter}
                      onChange={e => setMissingGamesGameFilter(e.target.value)}
                      className="appearance-none w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
                    >
                      <option value="all">All games needed</option>
                      {gamesMissing.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Results */}
              {qualifiersForMissingGames.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">
                  No upcoming qualifiers match your filters.
                </p>
              ) : (
                <div className="space-y-2">
                  {qualifiersForMissingGames.map(event => {
                    const gamesAtEvent = getMissingGamesAtEvent(event, gamesToFind)
                    const isAttended = attendedEvents.includes(event.id)
                    return (
                      <div
                        key={event.id}
                        className={`rounded-xl border p-3.5 ${isAttended ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-800">
                                {new Date(event.date).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </span>
                              {event.qualifier_number && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                  Q{event.qualifier_number}
                                </span>
                              )}
                              {isAttended && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Attended</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                              <MapPin size={11} className="flex-shrink-0" />
                              {event.venue}, {event.province}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {gamesAtEvent.map(game => (
                                <span key={game} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                                  {game}
                                </span>
                              ))}
                            </div>
                          </div>
                          <a href="/qualifiers" className="text-xs font-semibold text-green-700 hover:underline flex-shrink-0 mt-0.5">
                            View →
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {gamesMissing.length === 0 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
            <Trophy size={20} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-green-800">All 13 games covered!</p>
            <p className="text-xs text-green-600">You've run all games this season. Outstanding work.</p>
          </div>
        </div>
      )}

      </div> {/* end space-y-5 mt-5 */}
    </div>
  )
}

function StatPill({ value, label, sub, ok }) {
  return (
    <div className={`rounded-xl border p-3.5 text-center ${ok ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <p className={`text-2xl font-black ${ok ? 'text-green-700' : 'text-gray-700'}`}>{value}</p>
      <p className="text-xs font-semibold text-gray-600 mt-0.5">{label}</p>
      <p className={`text-[10px] mt-0.5 font-medium ${ok ? 'text-green-600' : 'text-yellow-600'}`}>{sub}</p>
    </div>
  )
}

function EligibilityItem({ met, label, detail }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${met ? 'bg-green-50' : 'bg-yellow-50'}`}>
      {met
        ? <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
        : <AlertCircle size={20} className="text-yellow-500 flex-shrink-0" />
      }
      <div>
        <p className={`text-sm font-medium ${met ? 'text-green-800' : 'text-yellow-800'}`}>{label}</p>
        <p className={`text-xs ${met ? 'text-green-600' : 'text-yellow-600'}`}>{detail}</p>
      </div>
    </div>
  )
}
