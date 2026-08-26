// Check the approval status of a Klippies access request by email.
// Returns { status: 'pending' | 'approved' | 'rejected' | 'not_found' }
import { createAdminClient } from '../_lib/supabaseAdmin.js'

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return await new Promise(resolve => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).end(); return }

  const body = await readJsonBody(req)
  const email = String(body.email || '').toLowerCase().trim()

  if (!email) {
    res.json({ status: 'not_found' })
    return
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('klippies_access_requests')
    .select('status')
    .eq('email', email)
    .maybeSingle()

  res.json({ status: data?.status ?? 'not_found' })
}
