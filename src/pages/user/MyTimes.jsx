import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { GAMES } from '../../lib/constants'
import { MATRIX, getLevel, getNationalsLevel, getTimeToNextLevel } from '../../lib/matrix'
import { Button, EmptyState, PageHeader, Skeleton } from '../../components/ui'
import {
  Trophy,
  Star,
  ChevronDown,
  Download,
  TrendingUp,
  Clock,
  AlertCircle,
  Target,
  Award,
  Calendar,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Constants ───────────────────────────────────────────────────────────────

const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700'
}

const CELL_LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700'
}

const LEVEL_DOT_COLORS = {
  0: '#9ca3af',
  1: '#3b82f6',
  2: '#22c55e',
  3: '#f97316',
  4: '#ef4444'
}


const LEVEL_DASH_COLORS = ['#bfdbfe', '#bbf7d0', '#fed7aa', '#fecaca']

const CURRENT_YEAR = new Date().getFullYear()

function buildYearOptions() {
  const years = []
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 4; y--) {
    years.push(y)
  }
  return years
}

// ─── Helper Components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, iconBg, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg flex-shrink-0 ${iconBg}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-gray-800 leading-none">{value}</div>
        <div className="text-xs text-gray-500 font-medium mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}


function TrendLineChart({ trendData, trendGame }) {
  if (!trendData || trendData.length === 0) return null

  const W = 680
  const H = 260
  const padL = 52
  const padR = 40
  const padT = 28
  const padB = 44

  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const times = trendData.map(d => d.time)
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const range = maxTime - minTime || 0.5
  const yPad = range * 0.2
  const yMin = minTime - yPad
  const yMax = maxTime + yPad

  // Fast (small time) → small pixel y → top of chart (better = higher)
  const toY = (time) => padT + (time - yMin) / (yMax - yMin) * chartH
  const toX = (i) =>
    trendData.length === 1
      ? padL + chartW / 2
      : padL + (i / (trendData.length - 1)) * chartW

  // Level threshold lines
  const thresholds = MATRIX[trendGame]
  const levelLines = []
  if (thresholds) {
    for (let l = 0; l <= 3; l++) {
      const boundaryTime = thresholds[l + 1][1]
      if (boundaryTime >= yMin && boundaryTime <= yMax) {
        levelLines.push({
          time: boundaryTime,
          label: `L${l + 1}`,
          y: toY(boundaryTime),
          color: LEVEL_DASH_COLORS[l]
        })
      }
    }
  }

  const pbTime = minTime
  const points = trendData.map((d, i) => ({
    x: toX(i),
    y: toY(d.time),
    time: d.time,
    date: d.qualifier_events?.date,
    level: getLevel(trendGame, d.time),
    isPB: d.time === pbTime
  }))

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ')

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    time: yMin + f * (yMax - yMin),
    y: padT + f * chartH
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: `${H}px` }}>
      {/* Background grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line
          key={f}
          x1={padL} y1={padT + f * chartH}
          x2={padL + chartW} y2={padT + f * chartH}
          stroke="#f3f4f6" strokeWidth="1"
        />
      ))}

      {/* Level threshold dashed lines */}
      {levelLines.map((line, i) => (
        <g key={i}>
          <line
            x1={padL} y1={line.y}
            x2={padL + chartW} y2={line.y}
            stroke={line.color} strokeWidth="1.5" strokeDasharray="5 3"
          />
          <rect
            x={padL + chartW + 4} y={line.y - 8}
            width={30} height={13}
            rx="3" fill={line.color} opacity="0.9"
          />
          <text
            x={padL + chartW + 19} y={line.y + 1.5}
            textAnchor="middle" fontSize="8.5" fill="#374151" fontWeight="700"
          >
            {line.label}
          </text>
        </g>
      ))}

      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#e5e7eb" strokeWidth="1" />
      <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke="#e5e7eb" strokeWidth="1" />

      {/* Y-axis ticks + labels */}
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line x1={padL - 4} y1={tick.y} x2={padL} y2={tick.y} stroke="#d1d5db" strokeWidth="1" />
          <text x={padL - 7} y={tick.y + 3.5} textAnchor="end" fontSize="9" fill="#9ca3af">
            {tick.time.toFixed(2)}s
          </text>
        </g>
      ))}

      {/* Polyline */}
      {points.length > 1 && (
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Data points */}
      {points.map((p, i) => {
        const color = LEVEL_DOT_COLORS[p.level] ?? '#6b7280'
        const showTimeLabel =
          points.length <= 10 || p.isPB || i === 0 || i === points.length - 1
        const showDateLabel =
          points.length <= 8 ||
          i % Math.ceil(points.length / 7) === 0 ||
          i === points.length - 1
        return (
          <g key={i}>
            {showTimeLabel && (
              <text
                x={p.x} y={p.y - 13}
                textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600"
              >
                {p.time.toFixed(3)}s
              </text>
            )}
            <circle
              cx={p.x} cy={p.y}
              r={p.isPB ? 6 : 4}
              fill={color} stroke="white" strokeWidth="2"
            />
            {p.isPB && (
              <text
                x={p.x} y={p.y + 19}
                textAnchor="middle" fontSize="9" fill="#b45309" fontWeight="700"
              >
                ★ PB
              </text>
            )}
            {showDateLabel && (
              <text
                x={p.x} y={padT + chartH + 15}
                textAnchor="middle" fontSize="8.5" fill="#9ca3af"
              >
                {new Date(p.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
              </text>
            )}
          </g>
        )
      })}

      {/* Y-axis label */}
      <text
        x={11} y={padT + chartH / 2}
        textAnchor="middle" fontSize="9" fill="#9ca3af"
        transform={`rotate(-90, 11, ${padT + chartH / 2})`}
      >
        Time (s)
      </text>
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MyTimes() {
  const { profile, isClubHead } = useAuth()
  const [combos, setCombos] = useState([])
  const [selectedCombo, setSelectedCombo] = useState(null)
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [personalBests, setPersonalBests] = useState({})
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('times')
  const [nationalsLevel, setNationalsLevel] = useState(null)
  const [levelBreakdown, setLevelBreakdown] = useState({})
  const [trendGame, setTrendGame] = useState(GAMES[0])
  const [trendData, setTrendData] = useState([])

  // Club head: linked riders selector
  const [linkedRiders, setLinkedRiders] = useState([])
  const [selectedRider, setSelectedRider] = useState(null)
  const [loadingRiders, setLoadingRiders] = useState(false)

  const effectiveUserId = isClubHead
    ? (selectedRider?.id || null)
    : profile?.id

  useEffect(() => {
    if (!profile) return
    if (isClubHead) {
      fetchLinkedRiders()
    } else {
      fetchCombos(profile.id)
    }
  }, [profile])

  useEffect(() => {
    if (isClubHead && selectedRider) {
      fetchCombos(selectedRider.id)
    } else if (isClubHead && !selectedRider) {
      setCombos([])
      setSelectedCombo(null)
    }
  }, [selectedRider])

  useEffect(() => {
    if (selectedCombo) {
      fetchPersonalBests()
      fetchHistory()
    }
  }, [selectedCombo, selectedYear])

  useEffect(() => {
    if (selectedCombo && trendGame) fetchTrendData()
  }, [selectedCombo, trendGame, selectedYear])

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
        setLoadingRiders(false)
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
      setLoading(false)
    }
  }

  async function fetchCombos(userId) {
    const { data } = await supabase
      .from('horse_rider_combos')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('is_pinned', { ascending: false })

    setCombos(data || [])
    if (data && data.length > 0) {
      setSelectedCombo(data.find(c => c.is_pinned) || data[0])
    } else {
      setSelectedCombo(null)
    }
    setLoading(false)
  }

  async function fetchPersonalBests() {
    const { data } = await supabase
      .from('personal_bests')
      .select('*')
      .eq('combo_id', selectedCombo.id)
      .eq('season_year', selectedYear)

    const pbMap = {}
    data?.forEach(pb => { pbMap[pb.game] = pb })
    setPersonalBests(pbMap)

    const timeMap = {}
    data?.forEach(pb => { timeMap[pb.game] = pb.best_time })
    const level = getNationalsLevel(timeMap)
    setNationalsLevel(level)

    const breakdown = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
    data?.forEach(pb => {
      const l = getLevel(pb.game, pb.best_time)
      if (l !== null) breakdown[l]++
    })
    setLevelBreakdown(breakdown)
  }

  async function fetchHistory() {
    const { data: yearEvents } = await supabase
      .from('qualifier_events')
      .select('id')
      .gte('date', `${selectedYear}-01-01`)
      .lte('date', `${selectedYear}-12-31`)

    const yearEventIds = yearEvents?.map(e => e.id) || []

    if (yearEventIds.length === 0) {
      setHistory([])
      return
    }

    const { data } = await supabase
      .from('qualifier_results')
      .select(`
        *,
        qualifier_events (
          date,
          venue,
          province,
          qualifier_number,
          event_type
        )
      `)
      .eq('combo_id', selectedCombo.id)
      .in('event_id', yearEventIds)
      .order('created_at', { ascending: false })

    const grouped = {}
    data?.forEach(result => {
      const eventId = result.event_id
      if (!grouped[eventId]) {
        grouped[eventId] = { event: result.qualifier_events, results: [] }
      }
      grouped[eventId].results.push(result)
    })

    setHistory(Object.values(grouped))
  }

  async function fetchTrendData() {
    const { data: yearEvents } = await supabase
      .from('qualifier_events')
      .select('id')
      .gte('date', `${selectedYear}-01-01`)
      .lte('date', `${selectedYear}-12-31`)

    const yearEventIds = yearEvents?.map(e => e.id) || []

    if (yearEventIds.length === 0) {
      setTrendData([])
      return
    }

    const { data } = await supabase
      .from('qualifier_results')
      .select(`time, is_nt, qualifier_events (date)`)
      .eq('combo_id', selectedCombo.id)
      .eq('game', trendGame)
      .eq('is_nt', false)
      .in('event_id', yearEventIds)
      .order('qualifier_events(date)', { ascending: true })

    setTrendData(data?.filter(d => d.time && !d.is_nt) || [])
  }

  // ── Computed values ──────────────────────────────────────────────────────────

  const gamesCovered = Object.keys(personalBests).length
  const gamesAtOrAboveLevel = nationalsLevel !== null
    ? Object.entries(personalBests).filter(([game, pb]) =>
        getLevel(game, pb.best_time) >= nationalsLevel
      ).length
    : 0

  const qualifiersAttended = history.length

  const ntCount = history.reduce(
    (sum, entry) => sum + entry.results.filter(r => r.is_nt).length,
    0
  )

  const pbsThisYear = Object.values(personalBests).filter(
    pb => new Date(pb.updated_at).getFullYear() === selectedYear
  ).length

  // Games closest to reaching their next level (for nationals card helper)
  const closestToNextLevel = Object.entries(personalBests)
    .map(([game, pb]) => {
      const level = getLevel(game, pb.best_time)
      if (level === null || level >= 4) return null
      const gap = getTimeToNextLevel(game, pb.best_time)
      if (gap === null) return null
      return { game, gap, level, nextLevel: level + 1 }
    })
    .filter(Boolean)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 5)

  // Qualifier grid data (shared between tab view and print area)
  const sortedEvents = [...history].sort((a, b) => {
    const dateA = new Date(a.event?.date || 0)
    const dateB = new Date(b.event?.date || 0)
    return dateA - dateB
  })

  const eventGameMap = {}
  sortedEvents.forEach(entry => {
    const eventId = entry.results[0]?.event_id
    if (!eventId) return
    eventGameMap[eventId] = {}
    entry.results.forEach(r => { eventGameMap[eventId][r.game] = r })
  })

  // ── Export ───────────────────────────────────────────────────────────────────

  const riderName = isClubHead
    ? (selectedRider?.rider_name || 'Rider')
    : (profile?.rider_name || 'Rider')

  async function handleExport(format) {
    if (format === 'csv') {
      const rows = [
        // Metadata block
        ['Rider', riderName],
        ['Horse', selectedCombo?.horse_name || '—'],
        ['Season', selectedYear],
        ['Nationals Level', nationalsLevel !== null ? `L${nationalsLevel}` : '—'],
        ['Games Covered', `${gamesCovered}/13`],
        ['Exported', new Date().toLocaleDateString('en-ZA')],
        [],
        // Column headers
        ['Game', 'Best Time (s)', 'Current Level', 'To Next Level (s)', 'Date Achieved'],
        // One row per game
        ...GAMES.map(game => {
          const pb = personalBests[game]
          const level = pb ? getLevel(game, pb.best_time) : null
          const timeToNext = pb ? getTimeToNextLevel(game, pb.best_time) : null
          return [
            game,
            pb ? pb.best_time?.toFixed(3) : 'No time',
            level !== null ? `L${level}` : '—',
            level === 4 ? 'Top Level' : timeToNext !== null ? `-${timeToNext.toFixed(3)}` : '—',
            pb ? new Date(pb.updated_at).toLocaleDateString('en-ZA') : '—'
          ]
        }),
        [],
        // Summary
        ['Nationals Level', nationalsLevel !== null ? `L${nationalsLevel}` : '—'],
        ['Qualifiers Attended', qualifiersAttended],
        ['PBs Set This Season', pbsThisYear],
        ['NT Count', ntCount],
      ]

      const csv = rows.map(r =>
        r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedCombo?.horse_name}_${riderName}_${selectedYear}_times.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported!')

    } else if (format === 'pdf') {
      // Inject print stylesheet
      const existing = document.getElementById('mytimes-print-style')
      if (existing) existing.remove()

      const style = document.createElement('style')
      style.id = 'mytimes-print-style'
      style.textContent = `
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body * { visibility: hidden !important; }
          #mytimes-print-area {
            display: block !important;
            visibility: visible !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
          }
          #mytimes-print-area * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-page {
            page-break-after: always;
            break-after: page;
          }
          .print-page-last {
            page-break-after: avoid;
            break-after: avoid;
          }
        }
      `
      document.head.appendChild(style)
      window.print()
    }
  }

  // ── Early returns ────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64" />
    </div>
  )

  if (isClubHead && linkedRiders.length === 0) return (
    <EmptyState
      title="No riders linked yet"
      description="Go to My Riders to add club members first."
      action={
        <a href="/my-club-riders" className="text-sm font-semibold text-green-800 hover:underline">
          Go to My Riders →
        </a>
      }
    />
  )

  if (!isClubHead && combos.length === 0) return (
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

  if (isClubHead && selectedRider && combos.length === 0) return (
    <div className="space-y-6">
      <PageHeader
        title="My Times"
        description={`Managing times for ${selectedRider?.rider_name || 'rider'}`}
      />
      {isClubHead && linkedRiders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Rider:</span>
            <div className="flex gap-2 flex-wrap">
              {linkedRiders.map(rider => (
                <button
                  key={rider.id}
                  onClick={() => setSelectedRider(rider)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
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
        </div>
      )}
      <EmptyState
        title={`${selectedRider?.rider_name} has no horses yet`}
        description="Add horses for this rider via the Horses page."
        action={<a href="/horses" className="text-sm font-semibold text-green-800 hover:underline">Go to Horses →</a>}
      />
    </div>
  )

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title="My Times"
        description={
          isClubHead
            ? `Managing times for ${selectedRider?.rider_name || 'rider'}`
            : 'Personal bests and Nationals level'
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="relative group">
              <Button variant="secondary">
                <Download size={16} />
                Export
              </Button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10 min-w-36 overflow-hidden">
                <button
                  onClick={() => handleExport('csv')}
                  className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                >
                  <span className="font-medium">Export CSV</span>
                  <span className="block text-xs text-gray-400">Personal bests &amp; stats</span>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="font-medium">Export PDF</span>
                  <span className="block text-xs text-gray-400">Qualifier grid, landscape</span>
                </button>
              </div>
            </div>
          </div>
        }
      />

      {/* ── Rider selector (club_head only) ────────────────────────────────── */}
      {isClubHead && linkedRiders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Rider:</span>
            <div className="flex gap-2 flex-wrap">
              {linkedRiders.map(rider => (
                <button
                  key={rider.id}
                  onClick={() => setSelectedRider(rider)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
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
        </div>
      )}

      {/* ── Combo + Year selector ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Horse/Rider:</span>
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

          <div className="flex items-center gap-2 ml-auto">
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
        </div>
      </div>

      {/* ── Nationals level card ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-green-200 text-sm font-medium">Nationals Level — {selectedYear}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-5xl font-bold">
                {nationalsLevel !== null ? `L${nationalsLevel}` : '—'}
              </span>
              {nationalsLevel !== null && (
                <span className="text-green-200 text-sm">
                  ({gamesAtOrAboveLevel}/13 games at this level)
                </span>
              )}
            </div>
            <p className="text-green-200 text-xs mt-2">
              Based on 8-out-of-13 rule · {gamesCovered}/13 games covered
            </p>

            {/* Level breakdown */}
            <div className="mt-4 flex gap-4 flex-wrap">
              {[4, 3, 2, 1, 0].map(level => (
                <div key={level} className="text-center">
                  <div className="text-xl font-bold">{levelBreakdown[level] || 0}</div>
                  <div className="text-green-200 text-xs">L{level}</div>
                </div>
              ))}
            </div>
          </div>
          <Trophy size={48} className="text-green-400 opacity-50 flex-shrink-0 ml-4" />
        </div>

        {/* Closest to next level hint */}
        {closestToNextLevel.length > 0 && (
          <div className="mt-5 pt-4 border-t border-green-500/40">
            <p className="text-green-200 text-xs font-semibold uppercase tracking-wide mb-2">
              Closest to next level
            </p>
            <div className="flex flex-col gap-1.5">
              {closestToNextLevel.map(({ game, gap, level, nextLevel }) => (
                <div key={game} className="flex items-center gap-2 text-xs">
                  <Target size={11} className="text-green-300 flex-shrink-0" />
                  <span className="text-white font-medium">{game}</span>
                  <span className="text-green-200">
                    — cut <span className="font-bold text-yellow-300">{gap.toFixed(3)}s</span> to reach L{nextLevel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Summary stats strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Qualifiers Attended"
          value={qualifiersAttended}
          sub={`in ${selectedYear}`}
          iconBg="bg-green-600"
          icon={Calendar}
        />
        <StatCard
          label="Games Covered"
          value={`${gamesCovered}/13`}
          sub="with a recorded time"
          iconBg="bg-blue-500"
          icon={Award}
        />
        <StatCard
          label="PBs Set"
          value={pbsThisYear}
          sub={`personal bests in ${selectedYear}`}
          iconBg="bg-yellow-500"
          icon={Star}
        />
        <StatCard
          label="NT Count"
          value={ntCount}
          sub="no-times this season"
          iconBg={ntCount > 0 ? 'bg-red-500' : 'bg-gray-400'}
          icon={AlertCircle}
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {['times', 'grid', 'history', 'trends'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'times'
              ? 'Personal Bests'
              : tab === 'grid'
              ? 'Qualifier Grid'
              : tab === 'history'
              ? 'Qualifier History'
              : 'Time Trends'}
          </button>
        ))}
      </div>

      {/* ── Personal Bests tab ─────────────────────────────────────────────── */}
      {activeTab === 'times' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Game</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Best Time</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Level</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Time to Next Level</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {GAMES.map(game => {
                const pb = personalBests[game]
                const level = pb ? getLevel(game, pb.best_time) : null
                const timeToNext = pb ? getTimeToNextLevel(game, pb.best_time) : null

                return (
                  <tr key={game} className={`hover:bg-gray-50 ${pb ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        {pb && <Star size={14} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                        {game}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pb ? (
                        <span className="font-bold text-gray-800">
                          {pb.best_time?.toFixed(3)}s
                        </span>
                      ) : (
                        <span className="text-gray-400">No time yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {level !== null ? (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${LEVEL_STYLES[level]}`}>
                          Level {level}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!pb ? (
                        <span className="text-gray-300">—</span>
                      ) : level === 4 ? (
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
                          Top Level
                        </span>
                      ) : timeToNext !== null ? (
                        <span className="text-sm font-semibold text-orange-600">
                          -{timeToNext.toFixed(3)}s to L{level + 1}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">
                      {pb ? new Date(pb.updated_at).toLocaleDateString('en-ZA') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Qualifier Grid tab ─────────────────────────────────────────────── */}
      {activeTab === 'grid' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {sortedEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No qualifier results for {selectedYear}.{' '}
              Use the Qualifier Tracker to enter times.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="text-sm border-collapse"
                style={{ minWidth: `${(sortedEvents.length + 2) * 120}px` }}
              >
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 border-r border-gray-200 min-w-[130px]">
                      Game
                    </th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-700 border-r border-gray-200 min-w-[90px]">
                      PB
                    </th>
                    {sortedEvents.map((entry, idx) => {
                      const ev = entry.event
                      const eventId = entry.results[0]?.event_id
                      return (
                        <th
                          key={eventId || idx}
                          className="text-center px-3 py-2 font-semibold text-gray-700 border-r border-gray-200 min-w-[110px]"
                        >
                          <div className="text-xs font-semibold text-gray-800">
                            {ev?.qualifier_number ? `Q${ev.qualifier_number}` : '—'}
                          </div>
                          <div className="text-xs font-normal text-gray-500 truncate max-w-[100px]" title={ev?.venue}>
                            {ev?.venue || 'Unknown'}
                          </div>
                          <div className="text-xs font-normal text-gray-400">
                            {ev?.date
                              ? new Date(ev.date).toLocaleDateString('en-ZA', {
                                  day: 'numeric',
                                  month: 'short'
                                })
                              : ''}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {GAMES.map(game => {
                    const pb = personalBests[game]
                    const pbLevel = pb ? getLevel(game, pb.best_time) : null

                    return (
                      <tr key={game} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800 sticky left-0 bg-white z-10 border-r border-gray-200 whitespace-nowrap">
                          {game}
                        </td>
                        {/* PB cell */}
                        <td className="px-3 py-2.5 text-center border-r border-gray-200">
                          {pb ? (
                            <span
                              className={`inline-block text-xs font-bold px-2 py-1 rounded ${
                                pbLevel !== null ? CELL_LEVEL_STYLES[pbLevel] : 'text-gray-500'
                              }`}
                            >
                              {pb.best_time?.toFixed(3)}s
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        {/* Qualifier result cells */}
                        {sortedEvents.map((entry, idx) => {
                          const eventId = entry.results[0]?.event_id
                          const result = eventGameMap[eventId]?.[game]
                          const level =
                            result && !result.is_nt
                              ? getLevel(game, result.time)
                              : null
                          const isThisPB =
                            pb &&
                            result &&
                            !result.is_nt &&
                            result.time === pb.best_time

                          return (
                            <td
                              key={eventId || idx}
                              className="px-3 py-2.5 text-center border-r border-gray-200"
                            >
                              {result ? (
                                result.is_nt ? (
                                  <span className="inline-block text-xs px-2 py-1 rounded bg-red-50 text-red-400 italic">
                                    NT
                                  </span>
                                ) : (
                                  <span
                                    className={`inline-block text-xs font-medium px-2 py-1 rounded ${
                                      level !== null ? CELL_LEVEL_STYLES[level] : 'text-gray-500'
                                    }`}
                                  >
                                    {isThisPB && '★ '}
                                    {result.time?.toFixed(3)}s
                                  </span>
                                )
                              ) : (
                                <span className="text-gray-200 text-xs">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-3 items-center">
            {[
              { label: 'Level 4', style: 'bg-red-100 text-red-700' },
              { label: 'Level 3', style: 'bg-orange-100 text-orange-700' },
              { label: 'Level 2', style: 'bg-green-100 text-green-700' },
              { label: 'Level 1', style: 'bg-blue-100 text-blue-700' },
              { label: 'Level 0', style: 'bg-gray-100 text-gray-600' },
            ].map(({ label, style }) => (
              <span key={label} className={`text-xs px-2 py-1 rounded font-medium ${style}`}>
                {label}
              </span>
            ))}
            <span className="text-xs px-2 py-1 rounded bg-red-50 text-red-400 italic">NT</span>
            <span className="text-xs text-gray-400 ml-1">★ = Personal Best</span>
          </div>
        </div>
      )}

      {/* ── Qualifier History tab ──────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No qualifier results for {selectedYear}.{' '}
              Use the Qualifier Tracker to enter times.
            </div>
          ) : (
            history.map((entry, index) => {
              const entryPBs = entry.results.filter(
                r => !r.is_nt && personalBests[r.game]?.best_time === r.time
              ).length
              const entryNTs = entry.results.filter(r => r.is_nt).length
              const entryGames = entry.results.length

              return (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-800">
                          {entry.event?.venue}, {entry.event?.province}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {new Date(entry.event?.date).toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                          {entry.event?.qualifier_number &&
                            ` · Q${entry.event.qualifier_number}`}
                        </p>
                      </div>
                      {/* Event summary badges */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                          {entryGames} games
                        </span>
                        {entryPBs > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                            ★ {entryPBs} PB{entryPBs > 1 ? 's' : ''}
                          </span>
                        )}
                        {entryNTs > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                            {entryNTs} NT
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {entry.results.map(result => {
                      const level = result.is_nt
                        ? null
                        : getLevel(result.game, result.time)
                      const isPB =
                        personalBests[result.game] &&
                        result.time === personalBests[result.game].best_time &&
                        !result.is_nt

                      return (
                        <div
                          key={result.id}
                          className="px-4 py-3 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {isPB && (
                              <Star
                                size={14}
                                className="text-yellow-400 fill-yellow-400"
                              />
                            )}
                            <span className="text-sm text-gray-700">{result.game}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {result.is_nt ? (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                                NT
                              </span>
                            ) : (
                              <>
                                <span className="text-sm font-medium text-gray-800">
                                  {result.time?.toFixed(3)}s
                                </span>
                                {level !== null && (
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_STYLES[level]}`}
                                  >
                                    L{level}
                                  </span>
                                )}
                              </>
                            )}
                            {isPB && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                                PB!
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Time Trends tab ────────────────────────────────────────────────── */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          {/* Game selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select game to view trend
            </label>
            <div className="relative inline-block">
              <select
                value={trendGame}
                onChange={e => setTrendGame(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
              >
                {GAMES.map(game => (
                  <option key={game} value={game}>{game}</option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Trend chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-600" />
              {trendGame} — {selectedYear} Time Progression
            </h3>

            {trendData.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No data for {trendGame} in {selectedYear}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <TrendLineChart trendData={trendData} trendGame={trendGame} />
                </div>

                {/* Legend */}
                <div className="mt-3 flex flex-wrap gap-2 items-center text-xs text-gray-500">
                  {[4, 3, 2, 1, 0].map(l => (
                    <span key={l} className={`px-2 py-0.5 rounded-full font-medium ${LEVEL_STYLES[l]}`}>
                      L{l}
                    </span>
                  ))}
                  <span className="text-gray-400 ml-1">— dashed lines mark level thresholds</span>
                </div>

                {trendData.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                    <TrendingUp size={16} className="text-green-600" />
                    {trendData[0].time > trendData[trendData.length - 1].time ? (
                      <span className="text-green-600 font-medium">
                        Improved by {(trendData[0].time - trendData[trendData.length - 1].time).toFixed(3)}s this season
                      </span>
                    ) : trendData[0].time < trendData[trendData.length - 1].time ? (
                      <span className="text-orange-500 font-medium">
                        Time increased by {(trendData[trendData.length - 1].time - trendData[0].time).toFixed(3)}s — keep practising!
                      </span>
                    ) : (
                      <span className="text-gray-500">Consistent times this season.</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Hidden PDF print area (4 pages) ───────────────────────────────── */}
      {(() => {
        const P = {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '10px',
          color: '#1f2937',
        }
        const PLVL = {
          0: { background: '#f3f4f6', color: '#4b5563' },
          1: { background: '#dbeafe', color: '#1d4ed8' },
          2: { background: '#dcfce7', color: '#15803d' },
          3: { background: '#ffedd5', color: '#c2410c' },
          4: { background: '#fee2e2', color: '#dc2626' },
        }
        const exportDate = new Date().toLocaleDateString('en-ZA', {
          day: 'numeric', month: 'long', year: 'numeric'
        })

        // Shared page header bar
        const PageHeader = ({ section }) => (
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            borderBottom: '2px solid #15803d',
            paddingBottom: '8px',
            marginBottom: '12px',
            ...P
          }}>
            <div>
              <div style={{ fontSize: '7px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                Klipklop
              </div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#15803d', letterSpacing: '-0.3px' }}>
                {section}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '9px', color: '#6b7280', lineHeight: '1.5' }}>
              <div>
                <strong style={{ color: '#1f2937' }}>{riderName}</strong>
                {' · '}
                <strong style={{ color: '#1f2937' }}>{selectedCombo?.horse_name}</strong>
                {' · Season '}
                <strong style={{ color: '#1f2937' }}>{selectedYear}</strong>
              </div>
              <div>
                Nationals Level: <strong style={{ color: '#15803d' }}>{nationalsLevel !== null ? `L${nationalsLevel}` : '—'}</strong>
                {' · '}Exported {exportDate}
              </div>
            </div>
          </div>
        )

        // Shared level legend
        const LevelLegend = () => (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', fontSize: '8.5px' }}>
            <strong style={{ color: '#374151' }}>Level key:</strong>
            {[
              { label: 'L4 — Top', ...PLVL[4] },
              { label: 'L3', ...PLVL[3] },
              { label: 'L2', ...PLVL[2] },
              { label: 'L1', ...PLVL[1] },
              { label: 'L0', ...PLVL[0] },
            ].map(({ label, background, color }) => (
              <span key={label} style={{ padding: '2px 7px', borderRadius: '4px', background, color, fontWeight: '600' }}>
                {label}
              </span>
            ))}
            <span style={{ color: '#f87171', fontStyle: 'italic' }}>NT = No Time</span>
            <span style={{ color: '#374151' }}>★ = Personal Best</span>
          </div>
        )

        return (
          <div id="mytimes-print-area" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1100px', background: 'white' }}>

            {/* ── PAGE 1: Personal Bests ─────────────────────────────────────── */}
            <div className="print-page" style={{ padding: '0', ...P }}>
              <PageHeader section="Personal Bests" />

              {/* Nationals summary strip */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Nationals Level', value: nationalsLevel !== null ? `L${nationalsLevel}` : '—', color: '#15803d' },
                  { label: 'Games Covered', value: `${gamesCovered}/13` },
                  { label: 'PBs Set', value: pbsThisYear },
                  { label: 'Qualifiers Attended', value: qualifiersAttended },
                  { label: 'NT Count', value: ntCount },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 12px', minWidth: '100px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: color || '#1f2937' }}>{value}</div>
                    <div style={{ fontSize: '8px', color: '#6b7280', marginTop: '1px' }}>{label}</div>
                  </div>
                ))}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: '700', color: '#374151', borderRight: '1px solid #e5e7eb' }}>Game</th>
                    <th style={{ textAlign: 'center', padding: '7px 10px', fontWeight: '700', color: '#374151', borderRight: '1px solid #e5e7eb' }}>Best Time</th>
                    <th style={{ textAlign: 'center', padding: '7px 10px', fontWeight: '700', color: '#374151', borderRight: '1px solid #e5e7eb' }}>Level</th>
                    <th style={{ textAlign: 'center', padding: '7px 10px', fontWeight: '700', color: '#374151', borderRight: '1px solid #e5e7eb' }}>To Next Level</th>
                    <th style={{ textAlign: 'center', padding: '7px 10px', fontWeight: '700', color: '#374151' }}>Date Achieved</th>
                  </tr>
                </thead>
                <tbody>
                  {GAMES.map((game, gIdx) => {
                    const pb = personalBests[game]
                    const level = pb ? getLevel(game, pb.best_time) : null
                    const timeToNext = pb ? getTimeToNextLevel(game, pb.best_time) : null
                    return (
                      <tr key={game} style={{ borderBottom: '1px solid #f3f4f6', background: gIdx % 2 === 0 ? 'white' : '#fafafa', opacity: pb ? 1 : 0.45 }}>
                        <td style={{ padding: '6px 10px', fontWeight: '600', color: '#1f2937', borderRight: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                          {pb ? '★ ' : ''}{game}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: '700', borderRight: '1px solid #e5e7eb' }}>
                          {pb ? `${pb.best_time?.toFixed(3)}s` : 'No time'}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>
                          {level !== null ? (
                            <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '9px', fontWeight: '600', ...PLVL[level] }}>
                              Level {level}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', borderRight: '1px solid #e5e7eb', color: '#ea580c', fontWeight: '600' }}>
                          {!pb ? '—' : level === 4 ? (
                            <span style={{ color: '#dc2626', fontWeight: '600' }}>Top Level</span>
                          ) : timeToNext !== null ? `-${timeToNext.toFixed(3)}s to L${level + 1}` : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#6b7280' }}>
                          {pb ? new Date(pb.updated_at).toLocaleDateString('en-ZA') : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <LevelLegend />
            </div>

            {/* ── PAGE 2: Qualifier Grid ─────────────────────────────────────── */}
            <div className="print-page" style={{ padding: '0', ...P }}>
              <PageHeader section="Qualifier Grid" />

              {sortedEvents.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
                  No qualifier results recorded for {selectedYear}.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: '700', color: '#374151', borderRight: '1px solid #e5e7eb', minWidth: '95px', whiteSpace: 'nowrap' }}>Game</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: '700', color: '#374151', borderRight: '1px solid #e5e7eb', minWidth: '60px' }}>PB</th>
                      {sortedEvents.map((entry, idx) => {
                        const ev = entry.event
                        const eventId = entry.results[0]?.event_id
                        return (
                          <th key={eventId || idx} style={{ textAlign: 'center', padding: '4px 5px', fontWeight: '600', color: '#374151', borderRight: '1px solid #e5e7eb', minWidth: '75px' }}>
                            <div style={{ fontWeight: '700', fontSize: '9.5px' }}>{ev?.qualifier_number ? `Q${ev.qualifier_number}` : '—'}</div>
                            <div style={{ fontWeight: '400', fontSize: '8px', color: '#6b7280', maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev?.venue || 'Unknown'}</div>
                            <div style={{ fontWeight: '400', fontSize: '8px', color: '#9ca3af' }}>
                              {ev?.date ? new Date(ev.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : ''}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {GAMES.map((game, gIdx) => {
                      const pb = personalBests[game]
                      const pbLevel = pb ? getLevel(game, pb.best_time) : null
                      return (
                        <tr key={game} style={{ borderBottom: '1px solid #f3f4f6', background: gIdx % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '5px 8px', fontWeight: '600', color: '#1f2937', borderRight: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{game}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>
                            {pb ? (
                              <span style={{ display: 'inline-block', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', ...(pbLevel !== null ? PLVL[pbLevel] : { color: '#6b7280' }) }}>
                                {pb.best_time?.toFixed(3)}s
                              </span>
                            ) : <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          {sortedEvents.map((entry, idx) => {
                            const eventId = entry.results[0]?.event_id
                            const result = eventGameMap[eventId]?.[game]
                            const level = result && !result.is_nt ? getLevel(game, result.time) : null
                            const isThisPB = pb && result && !result.is_nt && result.time === pb.best_time
                            return (
                              <td key={eventId || idx} style={{ padding: '5px 5px', textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>
                                {result ? (
                                  result.is_nt ? (
                                    <span style={{ fontSize: '8.5px', color: '#f87171', fontStyle: 'italic' }}>NT</span>
                                  ) : (
                                    <span style={{ display: 'inline-block', fontSize: '8.5px', fontWeight: isThisPB ? '700' : '500', padding: '2px 4px', borderRadius: '4px', ...(level !== null ? PLVL[level] : { color: '#6b7280' }) }}>
                                      {isThisPB ? '★ ' : ''}{result.time?.toFixed(3)}s
                                    </span>
                                  )
                                ) : <span style={{ color: '#e5e7eb', fontSize: '8.5px' }}>—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              <LevelLegend />
            </div>

            {/* ── PAGE 3: Qualifier History ──────────────────────────────────── */}
            <div className="print-page" style={{ padding: '0', ...P }}>
              <PageHeader section="Qualifier History" />

              {history.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
                  No qualifier results recorded for {selectedYear}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {history.map((entry, index) => {
                    const entryPBs = entry.results.filter(r => !r.is_nt && personalBests[r.game]?.best_time === r.time).length
                    const entryNTs = entry.results.filter(r => r.is_nt).length
                    return (
                      <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        {/* Event header */}
                        <div style={{ background: '#f9fafb', padding: '6px 10px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '10.5px', color: '#1f2937' }}>
                              {entry.event?.venue}, {entry.event?.province}
                            </div>
                            <div style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1px' }}>
                              {new Date(entry.event?.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                              {entry.event?.qualifier_number && ` · Q${entry.event.qualifier_number}`}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <span style={{ fontSize: '8px', padding: '2px 7px', borderRadius: '9999px', background: '#f3f4f6', color: '#4b5563', fontWeight: '600' }}>
                              {entry.results.length} games
                            </span>
                            {entryPBs > 0 && (
                              <span style={{ fontSize: '8px', padding: '2px 7px', borderRadius: '9999px', background: '#fef9c3', color: '#92400e', fontWeight: '600' }}>
                                ★ {entryPBs} PB{entryPBs > 1 ? 's' : ''}
                              </span>
                            )}
                            {entryNTs > 0 && (
                              <span style={{ fontSize: '8px', padding: '2px 7px', borderRadius: '9999px', background: '#fee2e2', color: '#dc2626', fontWeight: '600' }}>
                                {entryNTs} NT
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Results grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0' }}>
                          {entry.results.map(result => {
                            const level = result.is_nt ? null : getLevel(result.game, result.time)
                            const isPB = personalBests[result.game] && result.time === personalBests[result.game].best_time && !result.is_nt
                            return (
                              <div key={result.id} style={{ padding: '5px 8px', borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6' }}>
                                <div style={{ fontSize: '8px', color: '#6b7280', marginBottom: '2px' }}>{result.game}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {result.is_nt ? (
                                    <span style={{ fontSize: '9px', color: '#f87171', fontStyle: 'italic' }}>NT</span>
                                  ) : (
                                    <>
                                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#1f2937' }}>{result.time?.toFixed(3)}s</span>
                                      {level !== null && (
                                        <span style={{ fontSize: '7.5px', padding: '1px 4px', borderRadius: '4px', fontWeight: '600', ...PLVL[level] }}>L{level}</span>
                                      )}
                                      {isPB && <span style={{ fontSize: '7.5px', color: '#92400e', fontWeight: '700' }}>★</span>}
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── PAGE 4: Time Trends ────────────────────────────────────────── */}
            <div className="print-page-last" style={{ padding: '0', ...P }}>
              <PageHeader section={`Time Trends — ${trendGame}`} />

              {trendData.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
                  No trend data for {trendGame} in {selectedYear}. Select a game with results in the Time Trends tab before exporting.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '6px', fontSize: '9px', color: '#6b7280' }}>
                    Showing time progression for <strong style={{ color: '#1f2937' }}>{trendGame}</strong> across {trendData.length} qualifier{trendData.length > 1 ? 's' : ''} in {selectedYear}.
                    {trendData.length > 1 && trendData[0].time > trendData[trendData.length - 1].time && (
                      <span style={{ color: '#15803d', fontWeight: '700', marginLeft: '6px' }}>
                        ↑ Improved by {(trendData[0].time - trendData[trendData.length - 1].time).toFixed(3)}s this season
                      </span>
                    )}
                  </div>
                  <div style={{ width: '100%' }}>
                    <TrendLineChart trendData={trendData} trendGame={trendGame} />
                  </div>
                  {/* Trend data table */}
                  <table style={{ width: '60%', borderCollapse: 'collapse', fontSize: '9.5px', marginTop: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '5px 10px', fontWeight: '700', color: '#374151', borderRight: '1px solid #e5e7eb' }}>Date</th>
                        <th style={{ textAlign: 'center', padding: '5px 10px', fontWeight: '700', color: '#374151', borderRight: '1px solid #e5e7eb' }}>Time</th>
                        <th style={{ textAlign: 'center', padding: '5px 10px', fontWeight: '700', color: '#374151' }}>Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendData.map((entry, i) => {
                        const level = getLevel(trendGame, entry.time)
                        const isPB = entry.time === Math.min(...trendData.map(d => d.time))
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '5px 10px', color: '#374151', borderRight: '1px solid #e5e7eb' }}>
                              {new Date(entry.qualifier_events?.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: isPB ? '800' : '600', color: isPB ? '#15803d' : '#1f2937', borderRight: '1px solid #e5e7eb' }}>
                              {isPB ? '★ ' : ''}{entry.time?.toFixed(3)}s
                            </td>
                            <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                              {level !== null ? (
                                <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '9px', fontWeight: '600', ...PLVL[level] }}>L{level}</span>
                              ) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>

          </div>
        )
      })()}

    </div>
  )
}
