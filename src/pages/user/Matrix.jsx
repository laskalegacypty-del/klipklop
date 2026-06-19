import { useState } from 'react'
import { MATRIX, getLevel } from '../../lib/matrix'
import { QUALIFIER_GAMES } from '../../lib/constants'
import { PageHeader } from '../../components/ui'
import { Search, Calculator, ListChecks, X } from 'lucide-react'

const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
}

const LEVEL_ACTIVE_STYLES = {
  0: 'bg-gray-500 text-white border-gray-500',
  1: 'bg-blue-600 text-white border-blue-600',
  2: 'bg-green-600 text-white border-green-600',
  3: 'bg-orange-500 text-white border-orange-500',
  4: 'bg-red-600 text-white border-red-600',
}

const LEVEL_HEADER_STYLES = {
  0: 'bg-gray-200 text-gray-700',
  1: 'bg-blue-200 text-blue-800',
  2: 'bg-green-200 text-green-800',
  3: 'bg-orange-200 text-orange-800',
  4: 'bg-red-200 text-red-800',
}

const LEVEL_LABELS = {
  0: 'Level 0 · Slowest',
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
  4: 'Level 4 · Fastest',
}

const LEVEL_BG_GRADIENT = {
  0: 'from-gray-600 to-gray-700',
  1: 'from-blue-600 to-blue-700',
  2: 'from-green-700 to-green-800',
  3: 'from-orange-500 to-orange-600',
  4: 'from-red-600 to-red-700',
}

const LEVEL_CARD_STYLES = {
  0: 'bg-gray-50 border-gray-200 text-gray-800',
  1: 'bg-blue-50 border-blue-200 text-blue-900',
  2: 'bg-green-50 border-green-200 text-green-900',
  3: 'bg-orange-50 border-orange-200 text-orange-900',
  4: 'bg-red-50 border-red-200 text-red-900',
}

function formatRange(game, level) {
  const [min, max] = MATRIX[game][level]
  if (level === 0) return `≥ ${min.toFixed(3)}s`
  if (level === 4) return `≤ ${max.toFixed(3)}s`
  return `${min.toFixed(3)}s – ${max.toFixed(3)}s`
}

function LevelModal({ level, onClose }) {
  if (level === null) return null
  const allGames = Object.keys(MATRIX)
  const gradient = LEVEL_BG_GRADIENT[level]
  const cardStyle = LEVEL_CARD_STYLES[level]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${gradient} px-6 py-5 text-white flex-shrink-0`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                Time Thresholds
              </p>
              <h2 className="text-2xl font-bold">{LEVEL_LABELS[level]}</h2>
              <p className="text-sm text-white/70 mt-1">
                {allGames.length} games · {level === 4 ? 'fastest times qualify' : level === 0 ? 'slowest times qualify' : 'intermediate range'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Game grid */}
        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allGames.map(game => (
              <div
                key={game}
                className={`rounded-xl border p-4 ${cardStyle}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1 truncate">
                  {game}
                </p>
                <p className="text-xl font-bold leading-none tabular-nums">
                  {formatRange(game, level)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-3 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Tap anywhere outside to close
          </p>
        </div>
      </div>
    </div>
  )
}

function CellModal({ game, level, onClose }) {
  if (!game || level === null) return null
  const gradient = LEVEL_BG_GRADIENT[level]
  const range = formatRange(game, level)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Coloured header strip */}
        <div className={`bg-gradient-to-r ${gradient} px-6 pt-6 pb-8 text-white`}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-white/60">
              {LEVEL_LABELS[level]}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
          <h2 className="mt-3 text-2xl font-bold leading-tight">{game}</h2>
        </div>

        {/* Time range — pulled up to overlap the header */}
        <div className="-mt-5 mx-5 mb-5 bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 text-center">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-2">Time range</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{range}</p>

          {/* All levels mini-strip for context */}
          <div className="mt-4 grid grid-cols-5 gap-1">
            {[0, 1, 2, 3, 4].map(l => (
              <div
                key={l}
                className={`rounded-lg py-2 px-1 text-center text-[10px] font-semibold transition ${
                  l === level
                    ? `${LEVEL_STYLES[l]} ring-2 ring-offset-1 ring-current`
                    : `${LEVEL_STYLES[l]} opacity-40`
                }`}
              >
                <div className="font-bold mb-0.5">L{l}</div>
                <div className="leading-tight tabular-nums">{formatRange(game, l)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Matrix() {
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [levelModal, setLevelModal] = useState(null)
  const [cellModal, setCellModal] = useState(null)
  const [calcGame, setCalcGame] = useState('')
  const [calcTime, setCalcTime] = useState('')
  const [calcResult, setCalcResult] = useState(null)
  const [selectedQualifier, setSelectedQualifier] = useState(null)

  const allGames = Object.keys(MATRIX)
  const qualifierNumbers = Object.keys(QUALIFIER_GAMES).map(Number).sort((a, b) => a - b)
  const selectedQualifierGames = selectedQualifier ? QUALIFIER_GAMES[selectedQualifier] || [] : []

  const filteredGames = allGames.filter(game =>
    game.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const visibleLevels = levelFilter === 'all' ? [0, 1, 2, 3, 4] : [parseInt(levelFilter)]

  function handleCalculate() {
    if (!calcGame || !calcTime) return
    const time = parseFloat(calcTime)
    if (isNaN(time) || time <= 0) return
    setCalcResult(getLevel(calcGame, time))
  }

  return (
    <div className="space-y-6">
      <div className="fade-up fade-up-1">
        <PageHeader
          title="Level Matrix"
          description="Time thresholds for each game and level"
        />
      </div>

      {/* Time Calculator */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 fade-up fade-up-2">
        <div className="flex items-center gap-2 mb-4">
          <Calculator size={18} className="text-green-700" />
          <h2 className="font-semibold text-gray-800">Time Calculator</h2>
          <p className="text-sm text-gray-500 ml-1 hidden sm:block">— enter a game and time to find its level</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Game selector */}
          <div className="flex-1 min-w-44">
            <label className="block text-xs text-gray-500 mb-1.5">Game</label>
            <select
              value={calcGame}
              onChange={e => { setCalcGame(e.target.value); setCalcResult(null) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select a game…</option>
              {allGames.map(game => (
                <option key={game} value={game}>{game}</option>
              ))}
            </select>
          </div>

          {/* Time input */}
          <div className="flex-1 min-w-36">
            <label className="block text-xs text-gray-500 mb-1.5">Time (seconds)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={calcTime}
              onChange={e => { setCalcTime(e.target.value); setCalcResult(null) }}
              onKeyDown={e => e.key === 'Enter' && handleCalculate()}
              placeholder="e.g. 22.724"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Button */}
          <button
            onClick={handleCalculate}
            disabled={!calcGame || !calcTime}
            className="w-full sm:w-auto px-5 py-2 bg-green-800 text-white rounded-lg text-sm font-medium hover:bg-green-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Calculate
          </button>
        </div>

        {/* Result */}
        {calcResult !== null && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{parseFloat(calcTime).toFixed(3)}s</span>
                {' '}in <span className="font-semibold text-gray-800">{calcGame}</span>
                {' '}is:
              </span>
              <span className={`text-base font-bold px-4 py-1.5 rounded-full ${LEVEL_STYLES[calcResult]}`}>
                Level {calcResult}{calcResult === 4 ? ' — Fastest 🏆' : calcResult === 0 ? ' — Slowest' : ''}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 1, 2, 3, 4].map(level => (
                <div
                  key={level}
                  className={`rounded-lg p-2 text-center border-2 transition ${
                    calcResult === level
                      ? `${LEVEL_STYLES[level]} border-current shadow-sm ring-2 ring-offset-1 ring-current`
                      : `${LEVEL_STYLES[level]} border-transparent opacity-40`
                  }`}
                >
                  <div className="text-xs font-bold mb-0.5">L{level}</div>
                  <div className="text-xs leading-tight">{formatRange(calcGame, level)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 fade-up fade-up-3">
        {/* Search */}
        <div className="relative flex-1 min-w-44">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search game…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Level pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setLevelFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
              levelFilter === 'all'
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            All
          </button>
          {[0, 1, 2, 3, 4].map(l => (
            <button
              key={l}
              onClick={() => { setLevelFilter(levelFilter === String(l) ? 'all' : String(l)); setLevelModal(l) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
                levelFilter === String(l)
                  ? LEVEL_ACTIVE_STYLES[l]
                  : `${LEVEL_STYLES[l]} border-transparent hover:border-current`
              }`}
            >
              L{l}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden fade-up fade-up-4">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50 sticky left-0 z-10 min-w-36">
                  Game
                </th>
                {visibleLevels.map(level => (
                  <th
                    key={level}
                    className={`px-4 py-3 text-center font-semibold min-w-40 ${LEVEL_HEADER_STYLES[level]}`}
                  >
                    {LEVEL_LABELS[level]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGames.length === 0 ? (
                <tr>
                  <td colSpan={visibleLevels.length + 1} className="px-4 py-8 text-center text-gray-400">
                    No games match your search.
                  </td>
                </tr>
              ) : (
                filteredGames.map(game => (
                  <tr key={game} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 sticky left-0 bg-white z-10">
                      {game}
                    </td>
                    {visibleLevels.map(level => (
                      <td key={level} className="px-4 py-3 text-center">
                        <button
                          onClick={() => setCellModal({ game, level })}
                          className={`inline-block text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap transition hover:opacity-75 active:scale-95 cursor-pointer ${LEVEL_STYLES[level]}`}
                        >
                          {formatRange(game, level)}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer: result count + legend */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-3 items-center">
          <span className="text-xs text-gray-400 mr-auto">
            {filteredGames.length} of {allGames.length} games
            {levelFilter !== 'all' ? ` · Level ${levelFilter} only` : ''}
          </span>
          {[4, 3, 2, 1, 0].map(level => (
            <span key={level} className={`text-xs px-2 py-1 rounded font-medium ${LEVEL_STYLES[level]}`}>
              {LEVEL_LABELS[level]}
            </span>
          ))}
        </div>
      </div>

      {/* Qualifier Games Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 fade-up fade-up-5">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks size={18} className="text-green-700" />
          <h2 className="font-semibold text-gray-800">Qualifier Games</h2>
          <p className="text-sm text-gray-500 ml-1 hidden sm:block">— pick a qualifier to see which games are played</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {qualifierNumbers.map(num => {
            const isActive = selectedQualifier === num
            return (
              <button
                key={num}
                onClick={() => setSelectedQualifier(isActive ? null : num)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
                  isActive
                    ? 'bg-green-700 text-white border-green-700 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-green-400 hover:bg-green-50'
                }`}
              >
                Q{num}
              </button>
            )
          })}
        </div>

        {selectedQualifier && (
          <div className="mt-4 fade-up fade-up-1">
            <div className="absolute -top-2 left-6 w-3 h-3 bg-green-50 border-l border-t border-green-200 rotate-45" />
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-green-700 font-semibold">
                    Qualifier {selectedQualifier}
                  </p>
                  <p className="text-sm text-green-900 mt-0.5">
                    {selectedQualifierGames.length} game{selectedQualifierGames.length === 1 ? '' : 's'} in this qualifier
                  </p>
                </div>
                <button
                  onClick={() => setSelectedQualifier(null)}
                  className="p-1.5 rounded-md text-green-700 hover:text-green-900 hover:bg-green-100 transition"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {selectedQualifierGames.map(game => {
                  const hasMatrix = Boolean(MATRIX[game])
                  return (
                    <div key={game} className="bg-white rounded-lg border border-green-100 p-3">
                      <p className="font-semibold text-gray-800 text-sm mb-2">{game}</p>
                      {hasMatrix ? (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          {[0, 1, 2, 3, 4].map(level => (
                            <div key={level} className={`rounded-lg p-2 text-center ${LEVEL_STYLES[level]}`}>
                              <div className="text-[10px] font-bold mb-0.5">L{level}</div>
                              <div className="text-[11px] leading-tight">{formatRange(game, level)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No matrix data for this game.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <LevelModal level={levelModal} onClose={() => setLevelModal(null)} />
      <CellModal
        game={cellModal?.game ?? null}
        level={cellModal?.level ?? null}
        onClose={() => setCellModal(null)}
      />
    </div>
  )
}
