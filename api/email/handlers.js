import { createAdminClient, getUserFromFetch } from '../_lib/supabaseAdmin.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS })
}

async function requireAdminCaller(request) {
  const user = await getUserFromFetch(request)
  if (!user) return { error: json({ error: 'Unauthorized' }, 401) }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role, rider_name').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { error: json({ error: 'Forbidden' }, 403) }
  return { user, profile, admin }
}

async function sendResend({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'KlipKlop <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  })
  if (!emailRes.ok) {
    const errText = await emailRes.text()
    throw new Error(errText || 'Resend error')
  }
}

function appUrl() {
  return process.env.PUBLIC_APP_URL || 'https://klipklop.co.za'
}

export async function handleApprovalEmail(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!process.env.RESEND_API_KEY) return json({ error: 'RESEND_API_KEY is not configured' }, 503)

  const caller = await requireAdminCaller(request)
  if (caller.error) return caller.error

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const userId = body?.userId
  const riderName = body?.riderName
  if (!userId) return json({ error: 'Missing userId' }, 400)

  const { data: { user: targetUser }, error } = await caller.admin.auth.admin.getUserById(userId)
  if (error || !targetUser?.email) return json({ error: 'User not found' }, 404)

  await sendResend({
    to: targetUser.email,
    subject: 'Your KlipKlop account has been approved!',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        <h1 style="font-size:22px;font-weight:700;color:#111827;">Welcome, ${riderName || 'rider'}!</h1>
        <p style="font-size:15px;color:#374151;line-height:1.6;">
          Your KlipKlop account has been approved. Click below to subscribe and activate your membership.
        </p>
        <p><a href="${appUrl()}/subscribe" style="background:#166534;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;">Subscribe Now</a></p>
      </div>
    `,
  })
  return json({ ok: true })
}

export async function handleProfileAccessEmail(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!process.env.RESEND_API_KEY) return json({ error: 'RESEND_API_KEY is not configured' }, 503)

  const caller = await requireAdminCaller(request)
  if (caller.error) return caller.error

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const { userId, durationLabel, reason } = body || {}
  if (!userId || !durationLabel) return json({ error: 'Missing userId or durationLabel' }, 400)

  const { data: { user: targetUser }, error } = await caller.admin.auth.admin.getUserById(userId)
  if (error || !targetUser?.email) return json({ error: 'User not found' }, 404)

  const adminName = caller.profile?.rider_name || 'A KlipKlop admin'
  await sendResend({
    to: targetUser.email,
    subject: `${adminName} is requesting access to your KlipKlop profile`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        <h1 style="font-size:20px;font-weight:700;color:#111827;">Profile access request</h1>
        <p style="font-size:15px;color:#374151;line-height:1.6;">
          <strong>${adminName}</strong> has requested temporary access to your profile for <strong>${durationLabel}</strong>.
        </p>
        ${reason ? `<p style="font-size:14px;color:#4b5563;">"${reason}"</p>` : ''}
        <p><a href="${appUrl()}/profile" style="background:#166534;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;">Review request</a></p>
      </div>
    `,
  })
  return json({ ok: true })
}
