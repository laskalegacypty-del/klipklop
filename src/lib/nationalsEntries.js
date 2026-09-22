import { supabase } from './supabaseClient'
import { normalizeForMatch, stripDayAnnotation } from './runningListParser'

export const VISITOR_KEY = 'nationals_visitor_v1'

const PAGE_SIZE = 1000
const ENTRIES_CACHE_KEY = 'nationals_entries_cache_v1'
// Long enough that reopening the page or switching tabs doesn't re-fetch
// ~8000 rows again, short enough that an organizer's schedule fix shows up
// within a few minutes rather than needing a hard refresh.
const ENTRIES_CACHE_TTL_MS = 10 * 60 * 1000

// Supabase/PostgREST caps a single select at PAGE_SIZE rows by default, so a
// table this size (thousands of rows) needs explicit pagination or later
// pages silently go missing from the result. Pages don't depend on each
// other, so they're fetched in parallel rather than one after another —
// sequential pagination was the main cause of the slow initial load.
export async function fetchNationalsEntries() {
  const cached = readEntriesCache()
  if (cached) return cached

  const { count, error: countError } = await supabase
    .from('nationals_entries')
    .select('*', { count: 'exact', head: true })
  if (countError) throw countError

  const pageStarts = []
  for (let from = 0; from < (count || 0); from += PAGE_SIZE) pageStarts.push(from)
  if (!pageStarts.length) pageStarts.push(0)

  const pages = await Promise.all(
    pageStarts.map(async from => {
      const { data, error } = await supabase
        .from('nationals_entries')
        .select('*')
        .order('day', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return data || []
    })
  )

  const all = pages.flat()
  writeEntriesCache(all)
  return all
}

function readEntriesCache() {
  try {
    const raw = sessionStorage.getItem(ENTRIES_CACHE_KEY)
    if (!raw) return null
    const { entries, savedAt } = JSON.parse(raw)
    if (!Array.isArray(entries) || Date.now() - savedAt > ENTRIES_CACHE_TTL_MS) return null
    return entries
  } catch {
    return null
  }
}

function writeEntriesCache(entries) {
  try {
    sessionStorage.setItem(ENTRIES_CACHE_KEY, JSON.stringify({ entries, savedAt: Date.now() }))
  } catch {}
}

// "scheduled_time" is free text like "8:30–9:00" (no leading zero), so a
// plain string sort puts "10:00" before "8:30". Parse the start time into
// minutes-since-midnight for correct chronological ordering.
export function scheduledStartMinutes(scheduledTime) {
  const match = String(scheduledTime || '').match(/^(\d{1,2}):(\d{2})/)
  if (!match) return Number.POSITIVE_INFINITY
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

function tokenize(s) {
  return normalizeForMatch(s).split(' ').filter(Boolean)
}

// Order-independent token match, so "First Last" and "Last First" source
// data both work. Falls back to a surname-only match if no full-name row
// exists (e.g. the entry list has a maiden/married name mismatch).
export function findEntriesForName(entries, firstName, lastName) {
  const queryTokens = tokenize(`${firstName} ${lastName}`)
  if (!queryTokens.length) return []

  const fullMatches = entries.filter(entry => {
    const nameTokens = tokenize(stripDayAnnotation(entry.rider_name))
    return queryTokens.every(t => nameTokens.includes(t))
  })
  if (fullMatches.length) return fullMatches

  const surnameTokens = tokenize(lastName)
  if (!surnameTokens.length) return []
  return entries.filter(entry => {
    const nameTokens = tokenize(stripDayAnnotation(entry.rider_name))
    return surnameTokens.every(t => nameTokens.includes(t))
  })
}

export function groupByHorse(entries) {
  const map = new Map()
  for (const entry of entries) {
    const key = entry.horse_name || 'Horse to be confirmed'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(entry)
  }
  return Array.from(map.entries()).map(([horseName, rows]) => ({ horseName, entries: rows }))
}

export function loadVisitor() {
  try {
    const raw = localStorage.getItem(VISITOR_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveVisitor(visitor) {
  try {
    localStorage.setItem(VISITOR_KEY, JSON.stringify(visitor))
  } catch {}
}

export function clearVisitor() {
  try {
    localStorage.removeItem(VISITOR_KEY)
  } catch {}
}
