import { GAMES, normalizeGameName } from './constants'

export const TIMES_VIEW_TABS = ['times', 'year', 'grid', 'history', 'trends']

export const LEVEL_STYLES = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
}

export function buildYearOptions(currentYear = new Date().getFullYear()) {
  const years = []
  for (let y = currentYear; y >= currentYear - 4; y--) {
    years.push(y)
  }
  return years
}

export function buildCarryForwardPbMap(rows) {
  const map = {}
  rows?.forEach(row => {
    const game = normalizeGameName(row.game)
    if (!game) return
    const current = map[game]
    if (!current || row.best_time < current.best_time) {
      map[game] = { ...row, game }
    }
  })
  return map
}

export function formatPbDate(pb) {
  if (pb?.season_year) return String(pb.season_year)
  const fallback = pb?.achieved_at || pb?.updated_at || null
  return fallback ? String(new Date(fallback).getFullYear()) : '—'
}

export function isCurrentYearPb(pb, currentYear = new Date().getFullYear()) {
  return Number(pb?.season_year) === currentYear
}

export function buildTrendDataFromRows(trendRows, trendGame) {
  return (trendRows || [])
    .filter(row => row.game === trendGame && row.time != null)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .map(row => ({
      time: row.time,
      qualifier_events: { date: row.date },
    }))
}

export { GAMES }
