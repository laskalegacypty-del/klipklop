import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(PAYSTACK_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return expected === signature
}

async function findUserByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('get_profile_id_by_email', { p_email: email })
  if (error || !data) return null
  return data as string
}

async function findUserByCustomerCode(customerCode: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('paystack_customer_code', customerCode)
    .maybeSingle()
  if (error || !data) return null
  return data.id
}

Deno.serve(async (req) => {
  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''

  const valid = await verifySignature(rawBody, signature)
  if (!valid) {
    return new Response('unauthorized', { status: 401 })
  }

  let payload: {
    event: string
    data: {
      customer?: { email?: string; customer_code?: string }
      subscription_code?: string
      next_payment_date?: string
      plan?: unknown
    }
  }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const { event, data } = payload

  if (event === 'subscription.create') {
    const email = data.customer?.email
    if (email) {
      const userId = await findUserByEmail(email)
      if (userId) {
        await supabaseAdmin.from('profiles').update({
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
      const userId = await findUserByCustomerCode(customerCode)
      if (userId) {
        await supabaseAdmin.from('profiles').update({
          subscription_status: 'active',
          subscription_end_at: data.next_payment_date ?? null,
        }).eq('id', userId)
      }
    }
  } else if (event === 'subscription.disable' || event === 'subscription.not_renew') {
    const customerCode = data.customer?.customer_code
    if (customerCode) {
      const userId = await findUserByCustomerCode(customerCode)
      if (userId) {
        await supabaseAdmin.from('profiles').update({
          subscription_status: 'cancelled',
        }).eq('id', userId)
      }
    }
  } else if (event === 'invoice.payment_failed') {
    const customerCode = data.customer?.customer_code
    if (customerCode) {
      const userId = await findUserByCustomerCode(customerCode)
      if (userId) {
        await supabaseAdmin.from('profiles').update({
          subscription_status: 'past_due',
        }).eq('id', userId)
      }
    }
  }

  return new Response('ok', { status: 200 })
})
