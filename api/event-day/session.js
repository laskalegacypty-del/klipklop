import { createAuthedClient, getUserFromRequest } from '../_lib/supabaseAdmin.js'
import { readJsonBody, sendJson, getPublicOrigin, getBearerToken } from '../_lib/http.js'
import { generateShareToken } from '../_lib/shareToken.js'
import {
  buildEventDayHelperUrl,
  buildEventDayShareMessage,
} from '../_lib/eventDaySession.js'

const DEFAULT_EXPIRE_DAYS = 2

function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      sendJson(res, 401, { error: 'Unauthorized' })
      return
    }

    const body = await readJsonBody(req)
    const primaryEventId = String(body.primary_event_id || '').trim()
    const secondaryEventId = body.secondary_event_id ? String(body.secondary_event_id).trim() : null
    const isBackToBack = Boolean(body.is_back_to_back)
    const entries = Array.isArray(body.entries) ? body.entries : []
    const selectedEntryKeys = Array.isArray(body.selected_entry_keys) ? body.selected_entry_keys : []

    if (!primaryEventId) {
      sendJson(res, 400, { error: 'primary_event_id is required' })
      return
    }

    if (!entries.length || !selectedEntryKeys.length) {
      sendJson(res, 400, { error: 'entries and selected_entry_keys are required' })
      return
    }

    const token = getBearerToken(req)
    const authed = createAuthedClient(token)

    const shareToken = generateShareToken()
    const expiresAt = addDays(DEFAULT_EXPIRE_DAYS)

    const row = {
      token: shareToken,
      created_by: user.id,
      primary_event_id: primaryEventId,
      secondary_event_id: isBackToBack && secondaryEventId ? secondaryEventId : null,
      is_back_to_back: isBackToBack,
      entries,
      selected_entry_keys: selectedEntryKeys,
      expires_at: expiresAt,
    }

    const { data: inserted, error: insertError } = await authed
      .from('event_day_sessions')
      .insert(row)
      .select('id, token, expires_at, created_at')
      .single()

    if (insertError) {
      console.error('[event-day/session] insert error:', insertError)
      sendJson(res, 500, { error: insertError.message || 'Could not create session' })
      return
    }

    const { data: primaryEvent } = await authed
      .from('qualifier_events')
      .select('venue')
      .eq('id', primaryEventId)
      .maybeSingle()

    const origin = getPublicOrigin(req)
    const url = buildEventDayHelperUrl(origin, shareToken)

    sendJson(res, 200, {
      session: inserted,
      url,
      share_title: 'Event Day — KlipKlop',
      share_message: buildEventDayShareMessage({ venue: primaryEvent?.venue, url }),
    })
  } catch (err) {
    sendJson(res, 500, { error: err?.message || 'Server error' })
  }
}
