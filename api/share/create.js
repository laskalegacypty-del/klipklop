import { createAuthedClient, getUserFromRequest } from '../_lib/supabaseAdmin.js'
import { readJsonBody, sendJson, getPublicOrigin } from '../_lib/http.js'
import {
  generateShareToken,
  buildShareUrl,
  buildShareMessage,
  buildShareTitle,
} from '../_lib/shareToken.js'

const ONE_TIME_SAFETY_DAYS = 7
const DEFAULT_EXPIRE_DAYS = 7

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
    const comboId = String(body.combo_id || '').trim()
    const linkType = String(body.link_type || 'expires').trim()
    const expiresInDays = Number(body.expires_in_days) || DEFAULT_EXPIRE_DAYS

    if (!comboId) {
      sendJson(res, 400, { error: 'combo_id is required' })
      return
    }

    if (!['one_time', 'expires'].includes(linkType)) {
      sendJson(res, 400, { error: 'Invalid link_type' })
      return
    }

    const token = getBearerFromReq(req)
    const authed = createAuthedClient(token)
    const { data: canManage, error: canManageError } = await authed.rpc('user_can_manage_combo', {
      p_user_id: user.id,
      p_combo_id: comboId,
    })

    if (canManageError || !canManage) {
      sendJson(res, 403, { error: 'You cannot share times for this combo' })
      return
    }

    const { data: combo, error: comboError } = await authed
      .from('horse_rider_combos')
      .select('id, horse_name')
      .eq('id', comboId)
      .maybeSingle()

    if (comboError || !combo) {
      sendJson(res, 404, { error: 'Combo not found' })
      return
    }

    const shareToken = generateShareToken()
    const expiresAt = linkType === 'one_time'
      ? addDays(ONE_TIME_SAFETY_DAYS)
      : addDays(Math.min(Math.max(expiresInDays, 1), 90))

    const row = {
      token: shareToken,
      combo_id: comboId,
      created_by: user.id,
      link_type: linkType,
      expires_at: expiresAt,
      max_views: linkType === 'one_time' ? 1 : 999999,
    }

    const { data: inserted, error: insertError } = await authed
      .from('times_share_links')
      .insert(row)
      .select('id, token, link_type, expires_at, max_views, created_at')
      .single()

    if (insertError) {
      console.error('[share/create] insert error:', insertError)
      sendJson(res, 500, { error: insertError.message || 'Could not create share link' })
      return
    }

    const origin = getPublicOrigin(req)
    const url = buildShareUrl(origin, shareToken)
    const horseName = combo.horse_name || 'Horse'

    sendJson(res, 200, {
      link: inserted,
      url,
      share_title: buildShareTitle({ horseName }),
      share_message: buildShareMessage({ horseName, url }),
    })
  } catch (err) {
    sendJson(res, 500, { error: err?.message || 'Server error' })
  }
}

function getBearerFromReq(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = String(header).match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}
