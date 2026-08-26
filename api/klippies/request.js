// Submit a Klippies access request (name + email).
// Returns { status } — either 'pending' (new request) or the existing status if already submitted.
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
  const name = String(body.name || '').trim()
  const email = String(body.email || '').toLowerCase().trim()

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Name and valid email are required' })
    return
  }

  const admin = createAdminClient()

  // Check if already submitted
  const { data: existing } = await admin
    .from('klippies_access_requests')
    .select('status')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    res.json({ status: existing.status })
    return
  }

  const { error } = await admin
    .from('klippies_access_requests')
    .insert({ name, email })

  if (error) {
    res.status(500).json({ error: 'Failed to submit request' })
    return
  }

  res.json({ status: 'pending' })
}
