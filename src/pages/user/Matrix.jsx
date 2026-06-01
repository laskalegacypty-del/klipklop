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

const LEVEL_HEADER_STYLES = {
  0: 'bg-gray-200 text-gray-700',
  1: 'bg-blue-200 text-blue-800',
  2: 'bg-green-200 text-green-800',
  3: 'bg-orange-200 text-orange-800',
  4: 'bg-red-200 text-red-800',
}

function formatRange(game, level) {
  const [min, max] = MATRIX[game][level]
  if (level === 0) return `≥ ${min.toFixed(3)}s`
  if (level === 4) return `≤ ${max.toFixed(3)}s`
  return `${min.toFixed(3)}s – ${max.toFixed(3)}s`
}

export default function Matrix() {
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [calcGame, setCalcGame] = useState('')
  const [calcTime, setCalcTime] = useState('')
  const [calcResult, setCalcResult] = useState(null)
  const [selectedQualifier, setSelectedQualifier] = useState(null)

  const allGames = Object.keys(MATRIX)
  const qualifierNumbers = Object.keys(QUALIFIER_GAMES)
    .map(Number)
    .sort((a, b) => a - b)
  const selectedQualifierGames = selectedQualifier
    ? QUALIFIER_GAMES[selectedQualifier] || []
    : []

  const filteredGames = allGames.filter(game =>
    game.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const visibleLevels =
    levelFilter === 'all' ? [0, 1, 2, 3, 4] : [parseInt(levelFilter)]

  function handleCalculate() {
    if (!calcGame || !calcTime) return
    const time = parseFloat(calcTime)
    if (isNaN(time) || time <= 0) return
    const level = getLevel(calcGame, time)
    setCalcResult(level)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Level Matrix"
        subtitle="Time thresholds for each game and level"
      />

      {/* Time Calculator */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator size={18} className="text-green-700" />
          <h2 className="font-semibold text-gray-800">Time Calculator</h2>
          <p className="text-sm text-gray-500 ml-1">— select a game and enter a time to find its level</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Game selector */}
          <div className="flex-1 min-w-44">
            <label className="block text-xs text-gray-500 mb-1.5">Game</label>
            <select
              value={calcGame}
              onChange={e => {
                setCalcGame(e.target.value)
                setCalcResult(null)
              }}
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
              onChange={e => {
                setCalcTime(e.target.value)
                setCalcResult(null)
              }}
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

          {/* Result */}
          {calcResult !== null && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 flex-wrap">
              <span className="text-sm text-gray-600">
                <span className="font-medium">{parseFloat(calcTime).toFixed(3)}s</span>
                {' '}in{' '}
                <span className="font-medium">{calcGame}</span>
                {' '}qualifies as:
              </span>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${LEVEL_STYLES[calcResult]}`}>
                Level {calcResult}
              </span>

              {/* Show where it falls in the full range */}
              <div className="w-full mt-2 grid grid-cols-5 gap-1.5">
                {[0, 1, 2, 3, 4].map(level => (
                  <div
                    key={level}
                    className={`rounded-lg p-2 text-center border-2 transition ${
                      calcResult === level
                        ? `${LEVEL_STYLES[level]} border-current shadow-sm`
                        : 'border-transparent opacity-50'
                    } ${LEVEL_STYLES[level]}`}
                  >
                    <div className="text-xs font-bold mb-0.5">L{level}</div>
                    <div className="text-xs leading-tight">{formatRange(calcGame, level)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-44">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search game…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <select
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Levels</option>
          {[0, 1, 2, 3, 4].map(l => (
            <option key={l} value={l}>Level {l}</option>
          ))}
        </select>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                    Level {level}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGames.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleLevels.length + 1}
                    className="px-4 py-8 text-center text-gray-400"
                  >
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
                        <span
                          className={`inline-block text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap ${LEVEL_STYLES[level]}`}
                        >
                          {formatRange(game, level)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-3 items-center">
          <span className="text-xs text-gray-500 font-medium mr-1">Legend:</span>
          {[
            { level: 4, label: 'Level 4 (Fastest)' },
            { level: 3, label: 'Level 3' },
            { level: 2, label: 'Level 2' },
            { level: 1, label: 'Level 1' },
            { level: 0, label: 'Level 0 (Slowest)' },
          ].map(({ level, label }) => (
            <span
              key={level}
              className={`text-xs px-2 py-1 rounded font-medium ${LEVEL_STYLES[level]}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Qualifier Games Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks size={18} className="text-green-700" />
          <h2 className="font-semibold text-gray-800">Qualifier Games</h2>
          <p className="text-sm text-gray-500 ml-1">— pick a qualifier number to see the games that will be played</p>
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
          <div
            key={selectedQualifier}
            className="mt-4 relative"
            style={{ animation: 'matrixQualifierPop 200ms ease-out' }}
          >
            <style>{`
              @keyframes matrixQualifierPop {
                from { opacity: 0; transform: translateY(-6px); }
                to   { opacity: 1; transform: translateY(0); }
              }
            `}</style>
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
                  className="p-1 rounded-md text-green-700 hover:text-green-900 hover:bg-green-100 transition"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {selectedQualifierGames.map(game => {
                  const hasMatrix = Boolean(MATRIX[game])
                  return (
                    <div
                      key={game}
                      className="bg-white rounded-lg border border-green-100 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="font-semibold text-gray-800 text-sm">{game}</p>
                      </div>
                      {hasMatrix ? (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          {[0, 1, 2, 3, 4].map(level => (
                            <div
                              key={level}
                              className={`rounded-lg p-2 text-center ${LEVEL_STYLES[level]}`}
                            >
                              <div className="text-[10px] font-bold mb-0.5">L{level}</div>
                              <div className="text-[11px] leading-tight">{formatRange(game, level)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No matrix data available for this game.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
