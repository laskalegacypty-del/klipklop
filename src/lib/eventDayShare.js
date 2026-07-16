import { supabase } from './supabaseClient'

export const ACTIVE_SESSION_KEY = 'event-day:active-session'

function generateToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function getOrCreateDeviceId() {
  const key = 'event-day-device-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export function getHelperLabel(token) {
  return localStorage.getItem(`event-day-helper-label:${token}`) || ''
}

export function setHelperLabel(token, label) {
  if (label) {
    localStorage.setItem(`event-day-helper-label:${token}`, label)
  } else {
    localStorage.removeItem(`event-day-helper-label:${token}`)
  }
}

export function loadHelperLocalTimes(token, deviceId) {
  try {
    const raw = localStorage.getItem(`event-day-helper:${token}:${deviceId}`)
    if (!raw) return { enteredTimes: {}, helperLabel: getHelperLabel(token) }
    const parsed = JSON.parse(raw)
    return {
      enteredTimes: parsed.enteredTimes || {},
      helperLabel: parsed.helperLabel || getHelperLabel(token),
    }
  } catch {
    return { enteredTimes: {}, helperLabel: getHelperLabel(token) }
  }
}

export function saveHelperLocalTimes(token, deviceId, enteredTimes, helperLabel) {
  try {
    localStorage.setItem(`event-day-helper:${token}:${deviceId}`, JSON.stringify({
      enteredTimes,
      helperLabel,
    }))
    if (helperLabel) setHelperLabel(token, helperLabel)
  } catch { /* ignore */ }
}

const EXPIRE_DAYS = 2

export async function createEventDaySession(payload) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + EXPIRE_DAYS * 86400000).toISOString()

  const { data, error } = await supabase
    .from('event_day_sessions')
    .insert({
      token,
      primary_event_id: payload.primary_event_id,
      secondary_event_id: payload.secondary_event_id || null,
      is_back_to_back: payload.is_back_to_back || false,
      entries: payload.entries,
      selected_entry_keys: payload.selected_entry_keys,
      expires_at: expiresAt,
    })
    .select('id, token, expires_at, created_at')
    .single()

  if (error) throw new Error(error.message || 'Could not create helper link')

  const url = `${window.location.origin}/event-day/help/${token}`
  const venue = payload.venue || ''
  const shareMessage = `Help track times${venue ? ` at ${venue}` : ''} on KlipKlop:\n${url}`

  return {
    session: data,
    url,
    share_title: 'Event Day — KlipKlop',
    share_message: shareMessage,
  }
}

export async function fetchEventDaySession(token) {
  const { data, error } = await supabase.rpc('get_event_day_session', { p_token: token })
  if (error) throw new Error(error.message || 'Could not load session')
  if (!data?.ok) {
    const err = new Error(
      data?.reason === 'not_found'
        ? 'This link is invalid or no longer exists.'
        : 'This link has expired or been revoked.'
    )
    err.reason = data?.reason || 'not_found'
    err.status = 410
    throw err
  }
  return { session: data.session }
}

export async function syncHelperTimes(token, { times, helperLabel, deviceId }) {
  const { data, error } = await supabase.rpc('upsert_helper_times', {
    p_token: token,
    p_device_id: deviceId,
    p_helper_label: helperLabel || null,
    p_times: times,
  })
  if (error) throw new Error(error.message || 'Could not sync times')
  if (!data?.ok) throw new Error('Session no longer active')
  return data
}

export async function fetchHelperContributions(token) {
  const { data: session, error: sessionError } = await supabase
    .from('event_day_sessions')
    .select('id')
    .eq('token', token)
    .maybeSingle()

  if (sessionError || !session) return { contributions: [] }

  const { data: contributions, error } = await supabase
    .from('event_day_helper_times')
    .select('entry_key, event_id, game, time, is_nt, helper_label, device_id, updated_at')
    .eq('session_id', session.id)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message || 'Could not load helper times')
  return { contributions: contributions || [] }
}

export async function revokeEventDaySession(token) {
  const { error } = await supabase
    .from('event_day_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token)

  if (error) throw new Error(error.message || 'Could not revoke link')
  return { ok: true }
}

/** Merge helper rows into enteredTimes; organizer values win on conflict. */
export function mergeHelperContributions(enteredTimes, contributions, entryKeyFilter = null) {
  const next = { ...enteredTimes }

  for (const row of contributions) {
    if (entryKeyFilter && row.entry_key !== entryKeyFilter) continue

    const key = row.entry_key
    const eventId = row.event_id
    const game = row.game

    const existing = next[key]?.[eventId]?.[game]
    const hasOrganizer = existing && (existing.is_nt || (existing.time && existing.time.trim() !== ''))
    if (hasOrganizer) continue

    if (!next[key]) next[key] = {}
    if (!next[key][eventId]) next[key][eventId] = {}

    next[key][eventId][game] = {
      time: row.is_nt ? '' : (row.time != null ? String(row.time) : ''),
      is_nt: Boolean(row.is_nt),
    }
  }

  return next
}
