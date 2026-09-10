const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function handlePushSend(request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS })
  }
  return Response.json({
    error: 'Web Push is not wired on Workers yet',
    missing: ['web-push compatible Worker implementation', 'VAPID_PRIVATE_KEY'],
    hint: 'Keep using supabase/functions/send-push until this route is filled in.',
  }, { status: 501, headers: CORS })
}
