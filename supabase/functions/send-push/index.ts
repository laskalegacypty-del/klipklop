import webpush from 'npm:web-push@3'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@klipklop.co.za'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const TITLE_MAP: Record<string, string> = {
  account_approved: 'Account Approved ✓',
  account_rejected: 'Account Update',
  account_suspended: 'Account Suspended',
  account_unsuspended: 'Account Reinstated',
  new_announcement: 'New Announcement',
  new_pb: 'New Personal Best! 🏆',
  nationals_level_change: 'Nationals Level Updated',
  upcoming_qualifier: 'Upcoming Qualifier',
  new_registration: 'New Registration',
  supporter_request: 'Supporter Request',
  supporter_request_accepted: 'Supporter Request Accepted',
  supporter_request_rejected: 'Supporter Request Declined',
  club_link_request: 'Club Link Request',
  club_link_accepted: 'Club Link Accepted',
  club_link_rejected: 'Club Link Declined',
  horse_reminder_due: 'Reminder Due',
  friend_overtake: 'Someone Overtook You!',
}

function titleForType(type: string): string {
  return TITLE_MAP[type] ?? 'KlipKlop'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  let body: { record?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const record = body.record
  if (!record?.user_id) return new Response('no user_id', { status: 200 })

  const { user_id, type, message, link } = record as {
    user_id: string
    type: string
    message: string
    link?: string
  }

  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user_id)

  if (error || !subs?.length) return new Response('no subs', { status: 200 })

  const payload = JSON.stringify({
    title: titleForType(type),
    body: message,
    link: link || '/',
    tag: type,
  })

  await Promise.allSettled(
    subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      } catch (err: unknown) {
        const pushErr = err as { statusCode?: number }
        if (pushErr?.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }
    })
  )

  return new Response('ok', { status: 200 })
})
