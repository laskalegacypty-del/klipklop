import { createAdminClient, getUserFromRequest } from '../_lib/supabaseAdmin.js'
import { sendJson, getPublicOrigin } from '../_lib/http.js'
import { fetchShareTimesPayload, buildShareMeta } from '../_lib/shareTimesData.js'

const REASON_MESSAGES = {
  not_found: 'This link is invalid or no longer exists.',
  revoked: 'This link has been revoked by the rider.',
  expired: 'This link has expired.',
  used: 'This one-time link has already been used.',
}

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
      const { data: redeemResult, error: redeemError } = await admin.rpc('redeem_times_share_link', {
        p_token: token,
      })

      if (redeemError) {
        sendJson(res, 500, { error: redeemError.message || 'Could not redeem link' })
        return
      }

      if (!redeemResult?.ok) {
        const reason = redeemResult?.reason || 'not_found'
        sendJson(res, 410, {
          error: REASON_MESSAGES[reason] || REASON_MESSAGES.not_found,
          reason,
        })
        return
      }

      const selectedYear = new Date().getFullYear()
      const times = await fetchShareTimesPayload(admin, redeemResult.combo_id, selectedYear)
      const origin = getPublicOrigin(req)
      const shareMeta = buildShareMeta({
        horseName: times.combo.horse_name,
        riderName: times.rider_name,
        selectedYear: times.selected_year,
        origin,
        token,
      })

      sendJson(res, 200, {
        share_meta: shareMeta,
        times,
      })
      return
    }

    if (req.method === 'DELETE') {
      const user = await getUserFromRequest(req)
      if (!user) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }

      const { data: link, error: linkError } = await admin
        .from('times_share_links')
        .select('id, created_by, combo_id')
        .eq('token', token)
        .maybeSingle()

      if (linkError || !link) {
        sendJson(res, 404, { error: 'Link not found' })
        return
      }

      if (link.created_by !== user.id) {
        sendJson(res, 403, { error: 'Forbidden' })
        return
      }

      const { error: revokeError } = await admin
        .from('times_share_links')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', link.id)

      if (revokeError) {
        sendJson(res, 500, { error: revokeError.message || 'Could not revoke link' })
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
