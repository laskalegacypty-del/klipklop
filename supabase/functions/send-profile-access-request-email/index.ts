import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL') ?? 'https://klipklop.co.za'

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: CORS_HEADERS })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
  }

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('role, rider_name')
    .eq('id', user.id)
    .maybeSingle()

  if (callerProfile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS_HEADERS })
  }

  let body: { userId?: string; durationLabel?: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }

  const { userId, durationLabel, reason } = body
  if (!userId || !durationLabel) {
    return new Response(JSON.stringify({ error: 'Missing userId or durationLabel' }), { status: 400, headers: CORS_HEADERS })
  }

  const { data: { user: targetUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (userError || !targetUser?.email) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: CORS_HEADERS })
  }

  const adminName = callerProfile?.rider_name || 'A KlipKlop admin'

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'KlipKlop <onboarding@resend.dev>',
        to: [targetUser.email],
        subject: `${adminName} is requesting access to your KlipKlop profile`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
            <div style="background:#f0fdf4;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
              <p style="font-size:13px;font-weight:600;color:#166534;margin:0 0 8px;">KlipKlop</p>
              <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0;">Profile access request</h1>
            </div>
            <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px;">
              <strong>${adminName}</strong> has requested temporary access to view your profile details
              (horses, results, subscription status and club/supporter activity) for
              <strong>${durationLabel}</strong>.
            </p>
            ${reason ? `<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 16px;background:#f9fafb;border-radius:8px;padding:12px 16px;">"${reason}"</p>` : ''}
            <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
              Nothing happens until you approve this in the app. You can accept or decline the
              request, and revoke access at any time even after accepting.
            </p>
            <div style="text-align:center;margin:0 0 24px;">
              <a href="${PUBLIC_APP_URL}/profile"
                 style="display:inline-block;background:#166534;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
                Review request
              </a>
            </div>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('Resend error:', errText)
    }
  } catch (err) {
    console.error('Email send failed:', err)
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS })
})
