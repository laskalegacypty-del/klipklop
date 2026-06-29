import { createAdminClient, getUserFromRequest } from '../../_lib/supabaseAdmin.js'
import { readJsonBody, sendJson } from '../../_lib/http.js'
import {
  redeemSessionToken,
  eventDayErrorMessage,
  normalizeGameName,
} from '../../_lib/eventDaySession.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const token = String(req.query?.token || '').trim()
  if (!token) {
    sendJson(res, 400, { error: 'Token is required' })
    return
  }

  try {
    const admin = createAdminClient()

    if (req.method === 'PUT') {
      const deviceId = String(req.headers['x-device-id'] || '').trim()
      if (!deviceId) {
        sendJson(res, 400, { error: 'X-Device-Id header is required' })
        return
      }

      const redeem = await redeemSessionToken(token)
      if (!redeem?.ok) {
        const reason = redeem?.reason || 'not_found'
        sendJson(res, 410, { error: eventDayErrorMessage(reason), reason })
        return
      }

      const body = await readJsonBody(req)
      const times = Array.isArray(body.times) ? body.times : []
      const helperLabel = body.helper_label ? String(body.helper_label).trim().slice(0, 80) : null

      if (!times.length) {
        sendJson(res, 400, { error: 'times array is required' })
        return
      }

      const sessionId = redeem.session_id
      const now = new Date().toISOString()
      const rows = times.map(row => {
        const isNt = Boolean(row.is_nt)
        const rawTime = row.time != null && row.time !== '' ? Number(row.time) : null
        return {
          session_id: sessionId,
          device_id: deviceId,
          entry_key: String(row.entry_key || ''),
          event_id: String(row.event_id || ''),
          game: normalizeGameName(String(row.game || '')),
          time: isNt ? null : (rawTime != null && !Number.isNaN(rawTime) ? rawTime : null),
          is_nt: isNt,
          helper_label: helperLabel,
          updated_at: now,
        }
      }).filter(r => r.entry_key && r.event_id && r.game)

      if (!rows.length) {
        sendJson(res, 400, { error: 'No valid time entries' })
        return
      }

      const { error: upsertError } = await admin
        .from('event_day_helper_times')
        .upsert(rows, {
          onConflict: 'session_id,device_id,entry_key,event_id,game',
        })

      if (upsertError) {
        console.error('[event-day/times] upsert error:', upsertError)
        sendJson(res, 500, { error: upsertError.message || 'Could not save times' })
        return
      }

      sendJson(res, 200, { ok: true, saved: rows.length })
      return
    }

    if (req.method === 'GET') {
      const user = await getUserFromRequest(req)
      if (!user) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }

      const { data: session, error: sessionError } = await admin
        .from('event_day_sessions')
        .select('id, created_by')
        .eq('token', token)
        .maybeSingle()

      if (sessionError || !session) {
        sendJson(res, 404, { error: 'Session not found' })
        return
      }

      if (session.created_by !== user.id) {
        sendJson(res, 403, { error: 'Forbidden' })
        return
      }

      const { data: contributions, error: contribError } = await admin
        .from('event_day_helper_times')
        .select('entry_key, event_id, game, time, is_nt, helper_label, device_id, updated_at')
        .eq('session_id', session.id)
        .order('updated_at', { ascending: false })

      if (contribError) {
        sendJson(res, 500, { error: contribError.message || 'Could not load contributions' })
        return
      }

      sendJson(res, 200, { contributions: contributions || [] })
      return
    }

    sendJson(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    sendJson(res, 500, { error: err?.message || 'Server error' })
  }
}
