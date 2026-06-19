import { createClient } from '@supabase/supabase-js'

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
}

function getAnonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export function createAdminClient() {
  const url = getSupabaseUrl()
  const key = getServiceRoleKey()
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function createAuthedClient(accessToken) {
  const url = getSupabaseUrl()
  const key = getAnonKey()
  if (!url || !key) {
    throw new Error('Supabase URL/anon key is not configured')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  })
}

export async function getUserFromRequest(req) {
  const token = String(req.headers?.authorization || req.headers?.Authorization || '')
    .replace(/^Bearer\s+/i, '')
    .trim()
  if (!token) return null

  const client = createAuthedClient(token)
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
