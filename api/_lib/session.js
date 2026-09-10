import { getUserFromRequest, createAdminClient, createAuthedClient } from './supabaseAdmin.js'
import { getBearerToken, sendJson } from './http.js'
import { getD1 } from './d1.js'

export { getBearerToken }

function backend() {
  return String(process.env.DATA_BACKEND || 'supabase').toLowerCase() === 'd1' ? 'd1' : 'supabase'
}

export async function requireUser(req, res) {
  const user = await getUserFromRequest(req)
  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized' })
    return null
  }
  return user
}

export async function loadProfile(userId, token) {
  if (backend() === 'd1') {
    const db = getD1()
    if (!db) return null
    const row = await db.prepare('SELECT * FROM profiles WHERE id = ?').bind(userId).first()
    return row || null
  }
  const sb = token ? createAuthedClient(token) : createAdminClient()
  const { data } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
  return data || null
}

export async function requireCaller(req, res) {
  const user = await requireUser(req, res)
  if (!user) return null
  const token = getBearerToken(req)
  const profile = await loadProfile(user.id, token)
  return { user, profile, token, isAdmin: profile?.role === 'admin' }
}

export async function requireAdmin(req, res) {
  const caller = await requireCaller(req, res)
  if (!caller) return null
  if (!caller.isAdmin) {
    sendJson(res, 403, { error: 'Forbidden' })
    return null
  }
  return caller
}

export function pick(obj, keys) {
  const out = {}
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      out[key] = obj[key]
    }
  }
  return out
}
