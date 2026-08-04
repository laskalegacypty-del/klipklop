import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!

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

  let body: { reference?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }

  const { reference } = body
  if (!reference) {
    return new Response(JSON.stringify({ error: 'Missing reference' }), { status: 400, headers: CORS_HEADERS })
  }

  const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  })

  if (!paystackRes.ok) {
    return new Response(JSON.stringify({ error: 'Paystack verification failed' }), { status: 502, headers: CORS_HEADERS })
  }

  const paystackData = await paystackRes.json()
  if (paystackData.data?.status !== 'success') {
    return new Response(JSON.stringify({ error: 'Transaction not successful' }), { status: 400, headers: CORS_HEADERS })
  }

  const { error: updateError } = await supabaseAdmin.from('profiles').update({
    subscription_status: 'active',
    paystack_customer_code: paystackData.data.customer?.customer_code ?? null,
    subscription_end_at: new Date(Date.now() + 31 * 86400000).toISOString(),
  }).eq('id', user.id)

  if (updateError) {
    console.error('Profile update failed:', updateError.message)
    return new Response(JSON.stringify({ error: 'Failed to update profile' }), { status: 500, headers: CORS_HEADERS })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS })
})
