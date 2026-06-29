import { createAdminClient } from './supabaseAdmin.js'

const REASON_MESSAGES = {
  not_found: 'This link is invalid or no longer exists.',
  revoked: 'This link has been revoked.',
  expired: 'This link has expired.',
}

export function eventDayErrorMessage(reason) {
  return REASON_MESSAGES[reason] || REASON_MESSAGES.not_found
}

export async function redeemSessionToken(token) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('redeem_event_day_session', { p_token: token })
  if (error) throw error
  return data
}

export async function fetchSessionByToken(admin, token) {
  const { data: session, error } = await admin
    .from('event_day_sessions')
    .select('id, token, created_by, primary_event_id, secondary_event_id, is_back_to_back, entries, selected_entry_keys, expires_at, revoked_at, created_at')
    .eq('token', token)
    .maybeSingle()

  if (error) throw error
  if (!session) return null

  const eventIds = [session.primary_event_id, session.secondary_event_id].filter(Boolean)
  const { data: events } = await admin
    .from('qualifier_events')
    .select('id, date, venue, province, qualifier_number, event_type')
    .in('id', eventIds)

  const eventMap = {}
  events?.forEach(ev => { eventMap[ev.id] = ev })

  return {
    ...session,
    primary_event: eventMap[session.primary_event_id] || null,
    secondary_event: session.secondary_event_id ? (eventMap[session.secondary_event_id] || null) : null,
  }
}

export function buildEventDayHelperUrl(origin, token) {
  const base = String(origin || '').replace(/\/$/, '')
  return `${base}/event-day/help/${token}`
}

export function buildEventDayShareMessage({ venue, url }) {
  const place = venue || 'today\'s qualifier'
  return `Help track times at ${place} on KlipKlop:\n${url}`
}

const GAMES = [
  'Barrel Race', 'Birangle', 'Big T', 'Fig 8 Flags', 'Fig 8 Stake', 'Hurry Scurry',
  'Keyhole', 'Poles I', 'Poles II', 'Quadrangle', 'Single Stake', 'Speedball', 'Speed Barrels',
]

export function normalizeGameName(game) {
  if (!game) return ''
  const trimmed = String(game).trim()
  const match = GAMES.find(g => g.toLowerCase() === trimmed.toLowerCase())
  return match || trimmed
}
