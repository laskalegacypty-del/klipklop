import { createAdminClient, getUserFromRequest } from '../_lib/supabaseAdmin.js'
import { sendJson } from '../_lib/http.js'
import {
  redeemSessionToken,
  fetchSessionByToken,
  eventDayErrorMessage,
} from '../_lib/eventDaySession.js'

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

    if (req.method === 'GET') {
      const redeem = await redeemSessionToken(token)
      if (!redeem?.ok) {
        const reason = redeem?.reason || 'not_found'
        sendJson(res, 410, {
          error: eventDayErrorMessage(reason),
          reason,
        })
        return
      }

      const session = await fetchSessionByToken(admin, token)
      if (!session) {
        sendJson(res, 410, { error: eventDayErrorMessage('not_found'), reason: 'not_found' })
        return
      }

      sendJson(res, 200, { session })
      return
    }

    if (req.method === 'DELETE') {
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

      const { error: revokeError } = await admin
        .from('event_day_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', session.id)

      if (revokeError) {
        sendJson(res, 500, { error: revokeError.message || 'Could not revoke session' })
        return
      }

      sendJson(res, 200, { ok: true })
      return
    }

    sendJson(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    sendJson(res, 500, { error: err?.message || 'Server error' })
  }
}
