import { supabase } from './supabaseClient'
import { normalizeForMatch, stripDayAnnotation } from './runningListParser'

export const VISITOR_KEY = 'nationals_visitor_v1'

const PAGE_SIZE = 1000

// Supabase/PostgREST caps a single select at PAGE_SIZE rows by default, so a
// table this size (thousands of rows) needs explicit pagination or later
// pages silently go missing from the result.
export async function fetchNationalsEntries() {
  const all = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('nationals_entries')
      .select('*')
      .order('day', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
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
