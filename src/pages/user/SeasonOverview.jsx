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
  Target
} from 'lucide-react'
import { Card, CardContent, EmptyState, PageHeader, Skeleton } from '../../components/ui'
import { fetchClubHeadRoster, fetchCombosForRider } from '../../lib/clubRiderRoster'

const CURRENT_YEAR = new Date().getFullYear()

function buildYearOptions() {
  const years = []
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 4; y--) {
    years.push(y)
  }
  return years
}

// Season dates are approximate: qualifiers typically run Jan–Aug, Nationals in Sep/Oct
function getSeasonDates(year) {
  return {
    start: new Date(`${year}-01-01`),
    // Nationals typically end last week of September / first week of October
    end: new Date(`${year}-10-05`)
  }
}

function buildCarryForwardPbTimeMap(rows) {
  const map = {}
  rows?.forEach(row => {
    const game = normalizeGameName(row.game)
    if (!game) return
    const current = map[game]
    if (current === undefined || row.best_time < current) {
      map[game] = row.best_time
    }
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
    if (!current || bestTime < current.best_time) {
      map[game] = { game, best_time: bestTime }
    }
  })
  return map
}

function getMissingGamesAtEvent(event, missingGames) {
  if (!event.qualifier_number) return []
  const eventGames = QUALIFIER_GAMES[event.qualifier_number] || []
  return missingGames.filter(game => eventGames.includes(game))
}

function getQualifiersForMissingGames(events, missingGames, { province, month, game, todayStart }) {
  if (missingGames.length === 0) return []

  const gamesToMatch =
    game === 'all' ? missingGames : missingGames.filter(g => g === game)
  if (gamesToMatch.length === 0) return []

  return events
    .filter(event => {
      if (!event.qualifier_number) return false
      const eventDate = new Date(event.date)
      eventDate.setHours(0, 0, 0, 0)
      if (eventDate < todayStart) return false
      const coversMissing = getMissingGamesAtEvent(event, gamesToMatch).length > 0
      if (!coversMissing) return false
      if (province !== 'all' && event.province !== province) return false
      if (month !== 'all') {
        const eventMonth = new Date(event.date).getMonth()
        if (eventMonth !== Number(month)) return false
      }
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

  // Club head: linked riders
  const [linkedRiders, setLinkedRiders] = useState([])
  const [selectedRider, setSelectedRider] = useState(null)
  const [loadingRiders, setLoadingRiders] = useState(false)

  const effectiveUserId = profile?.id

  useEffect(() => {
    if (!profile) return
    if (isClubHead) {
      fetchLinkedRiders()
    } else {
      fetchData()
    }
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
    if (missingGamesGameFilter !== 'all' && !gamesMissingForFilter.includes(missingGamesGameFilter)) {
      setMissingGamesGameFilter('all')
    }
  }, [gamesMissingForFilter, missingGamesGameFilter])

  useEffect(() => {
    if (missingGamesMonthFilter === 'all') return
    const validMonths = upcomingMonthFilterOptions.map(opt => opt.value)
    if (!validMonths.includes(missingGamesMonthFilter)) {
      setMissingGamesMonthFilter('all')
    }
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
      const combosRes = await supabase
        .from('horse_rider_combos')
        .select('*')
        .eq('user_id', profile.id)
        .is('managed_rider_id', null)
        .eq('is_archived', false)
        .order('is_pinned', { ascending: false })
      combosData = combosRes.data || []
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

    // Fetch event IDs for selected year
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

    // Get unique attended events
    const uniqueEventIds = [...new Set(resultsRes.data?.map(r => r.event_id) || [])]
    setAttendedEvents(uniqueEventIds)

    // Build PB map
    const pbMap = buildCarryForwardPbTimeMap(pbsRes.data)
    setPersonalBests(pbMap)
    setSeasonCoveredGames(buildSeasonCoveredGameSet(resultsRes.data))
    setYearBests(buildYearBestsFromResults(resultsRes.data))
  }

  // Which games have been covered
  const gamesCovered = GAMES.filter(game => seasonCoveredGames.has(game))
  const gamesMissing = GAMES.filter(game => !seasonCoveredGames.has(game))

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const gamesToFind =
    missingGamesGameFilter === 'all'
      ? gamesMissing
      : gamesMissing.filter(game => game === missingGamesGameFilter)

  const qualifiersForMissingGames = getQualifiersForMissingGames(
    events,
    gamesMissing,
    {
      province: missingGamesProvinceFilter,
      month: missingGamesMonthFilter,
      game: missingGamesGameFilter,
      todayStart,
    }
  )

  // Eligibility checks
  const qualifiersAttended = attendedEvents.length
  const hasMinQualifiers = qualifiersAttended >= 2
  const hasMinGames = gamesCovered.length >= 11

  // Province qualifier check
  const effectiveProvince = isClubHead ? selectedRider?.province : profile?.province
  const provinceQualifiersAttended = attendedEvents.filter(eventId => {
    const event = events.find(e => e.id === eventId)
    return event?.province === effectiveProvince
  }).length
  const hasMinProvinceQualifiers = provinceQualifiersAttended >= 2

  const isEligible = hasMinQualifiers && hasMinGames && hasMinProvinceQualifiers

  // Nationals level
  const nationalsLevel = getNationalsLevel(personalBests)

  // Season progress (dynamic based on selected year)
  const today = todayStart
  const { start: seasonStart, end: seasonEnd } = getSeasonDates(selectedYear)
  const totalDays = (seasonEnd - seasonStart) / (1000 * 60 * 60 * 24)
  const daysPassed = Math.min(
    Math.max((today - seasonStart) / (1000 * 60 * 60 * 24), 0),
    totalDays
  )
  const seasonProgress = Math.round((daysPassed / totalDays) * 100)

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-32" />
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
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Season Overview"
        description={isClubHead && selectedRider ? `${selectedYear} Season — ${selectedRider.rider_name}` : `${selectedYear} Season`}
        actions={
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
                      setSelectedCombo(null)
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

      {/* Season progress bar */}
      <Card>
        <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Season Progress</span>
          <span className="text-sm font-bold text-green-800">{seasonProgress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-green-700 h-3 rounded-full transition-all"
            style={{ width: `${seasonProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">Jan {selectedYear}</span>
          <span className="text-xs text-gray-400">Nationals Oct {selectedYear}</span>
        </div>
        </CardContent>
      </Card>

      {/* Combo selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-600">Viewing:</span>
          <div className="flex gap-2 flex-wrap">
            {combos.map(combo => (
              <button
                key={combo.id}
                onClick={() => setSelectedCombo(combo)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  selectedCombo?.id === combo.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {combo.horse_name}
                {combo.is_pinned && ' ★'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Eligibility checklist */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Target size={20} className="text-green-600" />
          Nationals Eligibility — {selectedCombo?.horse_name}
        </h2>

        <div className="space-y-3">
          <EligibilityItem
            met={hasMinQualifiers}
            label="Minimum 2 qualifiers attended"
            detail={`${qualifiersAttended} qualifier${qualifiersAttended !== 1 ? 's' : ''} attended`}
          />
          <EligibilityItem
            met={hasMinProvinceQualifiers}
            label={`Minimum 2 qualifiers in ${profile?.province || 'your province'}`}
            detail={`${provinceQualifiersAttended} province qualifier${provinceQualifiersAttended !== 1 ? 's' : ''} attended`}
          />
          <EligibilityItem
            met={hasMinGames}
            label="Minimum 11 of 13 games covered"
            detail={`${gamesCovered.length} of 13 games covered`}
          />
          <EligibilityItem
            met={true}
            label="Account in good standing"
            detail="Account approved"
          />
        </div>

        <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
          isEligible
            ? 'bg-green-50 text-green-700'
            : 'bg-yellow-50 text-yellow-700'
        }`}>
          {isEligible
            ? '✓ You are on track for Nationals eligibility!'
            : '⚠ Complete the requirements above to qualify for Nationals.'}
        </div>
      </div>

      {/* Projected Nationals level */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-200 text-sm">Projected Nationals Level — {selectedYear}</p>
            <p className="text-4xl font-bold mt-1">
              {nationalsLevel !== null ? `Level ${nationalsLevel}` : '—'}
            </p>
            <p className="text-green-200 text-xs mt-1">
              Based on {gamesCovered.length}/13 games covered
              {gamesCovered.length < 13 && ' · projected from current times'}
            </p>
          </div>
          <Trophy size={44} className="text-green-400 opacity-50" />
        </div>
      </div>

      {/* Games covered */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Games Covered
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {gamesCovered.length} of 13 · {selectedYear} year-best times
        </p>

        {gamesCovered.length === 0 ? (
          <p className="text-sm text-gray-400">
            No games covered yet in {selectedYear}. Run at a qualifier to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gamesCovered.map(game => {
              const yearBest = yearBests[game]
              const level = yearBest ? getLevel(game, yearBest.best_time) : null

              return (
                <div
                  key={game}
                  className="rounded-lg border border-green-200 bg-green-50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {game}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {yearBest && (
                        <span className="text-xs font-semibold text-gray-700">
                          {yearBest.best_time.toFixed(3)}s
                        </span>
                      )}
                      {level !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_STYLES[level]}`}>
                          L{level}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Games not covered */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Games Not Covered
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {gamesMissing.length === 0
            ? 'All 13 games covered for this season.'
            : `${gamesMissing.length} game${gamesMissing.length !== 1 ? 's' : ''} still needed · find upcoming qualifiers below`}
        </p>

        {gamesMissing.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 mb-5">
              {gamesMissing.map(game => (
                <span
                  key={game}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200"
                >
                  <XCircle size={12} className="text-gray-400" />
                  {game}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-3 mb-5 p-4 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Game
                </label>
                <div className="relative">
                  <select
                    value={missingGamesGameFilter}
                    onChange={e => setMissingGamesGameFilter(e.target.value)}
                    className="appearance-none w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
                  >
                    <option value="all">All games needed</option>
                    {gamesMissing.map(game => (
                      <option key={game} value={game}>{game}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Province
                </label>
                <div className="relative">
                  <select
                    value={missingGamesProvinceFilter}
                    onChange={e => setMissingGamesProvinceFilter(e.target.value)}
                    className="appearance-none w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
                  >
                    <option value="all">All provinces</option>
                    {PROVINCES.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Month
                </label>
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
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Upcoming qualifiers with games you need
              <span className="font-normal text-gray-400 ml-1">
                ({qualifiersForMissingGames.length})
              </span>
            </h3>

            {qualifiersForMissingGames.length === 0 ? (
              <p className="text-sm text-gray-400">
                No upcoming qualifiers in {selectedYear} match your filters
                {missingGamesGameFilter !== 'all' ? ` for ${missingGamesGameFilter}` : ''}.
              </p>
            ) : (
              <div className="space-y-2">
                {qualifiersForMissingGames.map(event => {
                  const gamesAtEvent = getMissingGamesAtEvent(event, gamesToFind)
                  const isAttended = attendedEvents.includes(event.id)

                  return (
                    <div
                      key={event.id}
                      className={`rounded-lg border p-3 ${
                        isAttended
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-800">
                              {new Date(event.date).toLocaleDateString('en-ZA', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            {event.qualifier_number && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                                Q{event.qualifier_number}
                              </span>
                            )}
                            {isAttended && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                Attended
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                            <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate">{event.venue}, {event.province}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {gamesAtEvent.map(game => (
                              <span
                                key={game}
                                className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium"
                              >
                                {game}
                              </span>
                            ))}
                          </div>
                        </div>
                        <a
                          href="/qualifiers"
                          className="text-xs font-medium text-green-700 hover:underline flex-shrink-0"
                        >
                          View →
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {gamesMissing.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
            You have covered all 13 games this season.
          </div>
        )}
      </div>
    </div>
  )
}

function EligibilityItem({ met, label, detail }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${
      met ? 'bg-green-50' : 'bg-yellow-50'
    }`}>
      {met ? (
        <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
      ) : (
        <AlertCircle size={20} className="text-yellow-500 flex-shrink-0" />
      )}
      <div>
        <p className={`text-sm font-medium ${met ? 'text-green-800' : 'text-yellow-800'}`}>
          {label}
        </p>
        <p className={`text-xs ${met ? 'text-green-600' : 'text-yellow-600'}`}>
          {detail}
        </p>
      </div>
    </div>
  )
}
