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

export default function SeasonOverview() {
  const { profile, isClubHead } = useAuth()
  const [combos, setCombos] = useState([])
  const [selectedCombo, setSelectedCombo] = useState(null)
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [attendedEvents, setAttendedEvents] = useState([])
  const [personalBests, setPersonalBests] = useState({})
  const [bookmarks, setBookmarks] = useState([])

  // Club head: linked riders
  const [linkedRiders, setLinkedRiders] = useState([])
  const [selectedRider, setSelectedRider] = useState(null)
  const [loadingRiders, setLoadingRiders] = useState(false)

  const effectiveUserId = isClubHead ? (selectedRider?.id || null) : profile?.id

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
        .select('id, rider_name, province, profile_photo_url')
        .in('id', riderIds)

      const riderList = riders || []
      setLinkedRiders(riderList)
      if (riderList.length > 0) setSelectedRider(riderList[0])
    } finally {
      setLoadingRiders(false)
    }
  }

  async function fetchData() {
    setLoading(true)
    const uid = isClubHead ? selectedRider?.id : profile?.id
    if (!uid) { setLoading(false); return }

    const yearStart = `${selectedYear}-01-01`
    const yearEnd = `${selectedYear}-12-31`

    const [combosRes, eventsRes, bookmarksRes] = await Promise.all([
      supabase
        .from('horse_rider_combos')
        .select('*')
        .eq('user_id', uid)
        .eq('is_archived', false)
        .order('is_pinned', { ascending: false }),
      supabase
        .from('qualifier_events')
        .select('*')
        .gte('date', yearStart)
        .lte('date', yearEnd)
        .order('date', { ascending: true }),
      supabase
        .from('bookmarked_events')
        .select('event_id')
        .eq('user_id', profile.id)
    ])

    setCombos(combosRes.data || [])
    setEvents(eventsRes.data || [])
    setBookmarks(bookmarksRes.data?.map(b => b.event_id) || [])

    if (combosRes.data && combosRes.data.length > 0) {
      setSelectedCombo(
        combosRes.data.find(c => c.is_pinned) || combosRes.data[0]
      )
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
  }

  // Which games have been covered
  const gamesCovered = GAMES.filter(game => personalBests[game] !== undefined)
  const gamesMissing = GAMES.filter(game => personalBests[game] === undefined)

  // For each missing game, which upcoming events cover it
  function getUpcomingEventsForGame(game) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return events.filter(event => {
      if (new Date(event.date) < today) return false
      if (!event.qualifier_number) return false
      const games = QUALIFIER_GAMES[event.qualifier_number] || []
      return games.includes(game)
    }).slice(0, 2)
  }

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
  const today = new Date()
  const { start: seasonStart, end: seasonEnd } = getSeasonDates(selectedYear)
  const totalDays = (seasonEnd - seasonStart) / (1000 * 60 * 60 * 24)
  const daysPassed = Math.min(
    Math.max((today - seasonStart) / (1000 * 60 * 60 * 24), 0),
    totalDays
  )
  const seasonProgress = Math.round((daysPassed / totalDays) * 100)

  // Province events
  const provinceEvents = events.filter(e => e.province === profile?.province)
  const upcomingProvinceEvents = provinceEvents.filter(
    e => new Date(e.date) >= today
  )

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

      {/* Games coverage */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Games Coverage
        </h2>

        <div className="grid grid-cols-1 gap-3">
          {GAMES.map(game => {
            const pb = personalBests[game]
            const level = pb !== undefined ? getLevel(game, pb) : null
            const covered = pb !== undefined
            const upcomingForGame = !covered ? getUpcomingEventsForGame(game) : []

            return (
              <div
                key={game}
                className={`rounded-lg border p-3 ${
                  covered
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {covered ? (
                      <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-gray-300 flex-shrink-0" />
                    )}
                    <span className={`text-sm font-medium ${
                      covered ? 'text-gray-800' : 'text-gray-500'
                    }`}>
                      {game}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {covered && pb !== undefined && (
                      <span className="text-xs text-gray-500">
                        {pb.toFixed(3)}s
                      </span>
                    )}
                    {level !== null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        level === 0 ? 'bg-gray-100 text-gray-600' :
                        level === 1 ? 'bg-blue-100 text-blue-700' :
                        level === 2 ? 'bg-green-100 text-green-700' :
                        level === 3 ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        L{level}
                      </span>
                    )}
                  </div>
                </div>

                {/* Upcoming events that cover this game */}
                {!covered && upcomingForGame.length > 0 && (
                  <div className="mt-2 pl-6 space-y-1">
                    <p className="text-xs text-gray-400 font-medium">
                      Available at:
                    </p>
                    {upcomingForGame.map(event => (
                      <div key={event.id} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar size={10} className="text-gray-400" />
                        {new Date(event.date).toLocaleDateString('en-ZA', {
                          day: 'numeric',
                          month: 'short'
                        })} · {event.venue}, {event.province} · Q{event.qualifier_number}
                      </div>
                    ))}
                  </div>
                )}

                {!covered && upcomingForGame.length === 0 && (
                  <p className="mt-1 pl-6 text-xs text-gray-400">
                    No upcoming events cover this game
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Province qualifier timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {profile?.province} Qualifiers — {selectedYear}
        </h2>

        {provinceEvents.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No events found for {profile?.province} in {selectedYear}
          </p>
        ) : (
          <div className="space-y-2">
            {provinceEvents.map(event => {
              const isPast = new Date(event.date) < today
              const isAttended = attendedEvents.includes(event.id)
              const isBookmarked = bookmarks.includes(event.id)

              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    isAttended
                      ? 'bg-green-50 border border-green-200'
                      : isPast
                      ? 'bg-gray-50 border border-gray-100 opacity-60'
                      : isBookmarked
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  {/* Status indicator */}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    isAttended
                      ? 'bg-green-500'
                      : isPast
                      ? 'bg-gray-300'
                      : isBookmarked
                      ? 'bg-blue-400'
                      : 'bg-gray-200'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-700">
                        {new Date(event.date).toLocaleDateString('en-ZA', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        {event.venue}
                      </span>
                      {event.qualifier_number && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          Q{event.qualifier_number}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {isAttended && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Attended
                      </span>
                    )}
                    {!isAttended && !isPast && isBookmarked && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        Saved
                      </span>
                    )}
                    {!isAttended && isPast && (
                      <span className="text-xs text-gray-400">Missed</span>
                    )}
                  </div>
                </div>
              )
            })}
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
