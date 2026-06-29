import { Modal, Button } from '../ui'
import { QUALIFIER_GAMES } from '../../lib/constants'
import { getLevel } from '../../lib/matrix'

const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
}

export default function EventDayTimeModal({
  entry,
  activeEvents,
  getGameEntry,
  setGameEntry,
  onClose,
}) {
  if (!entry) return null

  function getLiveLevel(event, game) {
    const g = getGameEntry(entry, event, game)
    if (g.is_nt || !g.time) return null
    const t = parseFloat(g.time)
    if (isNaN(t)) return null
    return getLevel(game, t)
  }

  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      title={`#${entry.runNumber} · ${entry.horseName}`}
      size="lg"
    >
      <div className="space-y-5 max-h-[70vh] overflow-y-auto -mx-2 px-2">
        {activeEvents.map(event => {
          const games = QUALIFIER_GAMES[event.qualifier_number] || []
          return (
            <div key={event.id}>
              <div className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3">
                Q{event.qualifier_number} — {event.venue}
              </div>
              <div className="space-y-2">
                {games.map(game => {
                  const g = getGameEntry(entry, event, game)
                  const level = getLiveLevel(event, game)
                  return (
                    <div key={game} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div className="w-32 text-sm text-gray-700 font-medium flex-shrink-0">{game}</div>
                      <div className="flex-1">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="00.000"
                          disabled={g.is_nt}
                          value={g.time}
                          onChange={e => setGameEntry(entry, event, game, { time: e.target.value })}
                          className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setGameEntry(entry, event, game, { is_nt: !g.is_nt, time: g.is_nt ? '' : g.time })}
                        className={`px-3 h-10 rounded-lg text-xs font-bold border transition flex-shrink-0 ${g.is_nt ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-600'}`}
                      >
                        NT
                      </button>
                      {level !== null && (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${LEVEL_STYLES[level]}`}>
                          L{level}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="pt-2">
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
