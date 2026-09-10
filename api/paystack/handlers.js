import { createAdminClient, getUserFromFetch } from '../_lib/supabaseAdmin.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Paystack-Signature',
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS })
}

async function hmacSha512Hex(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function findUserByEmail(admin, email) {
  const { data, error } = await admin.rpc('get_profile_id_by_email', { p_email: email })
  if (error || !data) return null
  return data
}

async function findUserByCustomerCode(admin, customerCode) {
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('paystack_customer_code', customerCode)
    .maybeSingle()
  if (error || !data) return null
  return data.id
}

export async function handlePaystackVerify(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const user = await getUserFromFetch(request)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return json({ error: 'PAYSTACK_SECRET_KEY is not configured' }, 503)

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const reference = body?.reference
  if (!reference) return json({ error: 'Missing reference' }, 400)

  const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  if (!paystackRes.ok) return json({ error: 'Paystack verification failed' }, 502)

  const paystackData = await paystackRes.json()
  if (paystackData.data?.status !== 'success') {
    return json({ error: 'Transaction not successful' }, 400)
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({
    subscription_status: 'active',
    paystack_customer_code: paystackData.data.customer?.customer_code ?? null,
    subscription_end_at: new Date(Date.now() + 31 * 86400000).toISOString(),
  }).eq('id', user.id)

  if (error) return json({ error: 'Failed to update profile' }, 500)
  return json({ success: true })
}

export async function handlePaystackWebhook(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return new Response('not configured', { status: 503, headers: CORS })

  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature') || ''
  const expected = await hmacSha512Hex(secret, rawBody)
  if (expected !== signature) return new Response('unauthorized', { status: 401, headers: CORS })

  let payload
  try { payload = JSON.parse(rawBody) } catch { return new Response('bad request', { status: 400, headers: CORS }) }

  const event = payload.event
  const data = payload.data || {}
  const admin = createAdminClient()

  if (event === 'subscription.create') {
    const email = data.customer?.email
    if (email) {
      const userId = await findUserByEmail(admin, email)
      if (userId) {
        await admin.from('profiles').update({
          subscription_status: 'active',
          paystack_subscription_code: data.subscription_code ?? null,
          paystack_customer_code: data.customer?.customer_code ?? null,
          subscription_end_at: data.next_payment_date ?? null,
        }).eq('id', userId)
      }
    }
  } else if (event === 'charge.success' && data.plan) {
    const customerCode = data.customer?.customer_code
    if (customerCode) {
      const userId = await findUserByCustomerCode(admin, customerCode)
      if (userId) {
        await admin.from('profiles').update({
          subscription_status: 'active',
          subscription_end_at: data.next_payment_date ?? null,
        }).eq('id', userId)
      }
    }
  } else if (event === 'subscription.disable' || event === 'subscription.not_renew') {
    const customerCode = data.customer?.customer_code
    if (customerCode) {
      const userId = await findUserByCustomerCode(admin, customerCode)
      if (userId) {
        await admin.from('profiles').update({ subscription_status: 'cancelled' }).eq('id', userId)
      }
    }
  } else if (event === 'invoice.payment_failed') {
    const customerCode = data.customer?.customer_code
    if (customerCode) {
      const userId = await findUserByCustomerCode(admin, customerCode)
      if (userId) {
        await admin.from('profiles').update({ subscription_status: 'past_due' }).eq('id', userId)
      }
    }
  }

  return new Response('ok', { status: 200, headers: CORS })
}
