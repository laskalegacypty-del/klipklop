// Lightweight event logger for the public Klippies page.
// Accepts { visitorId, eventType } and inserts into klippies_events via service role.
// No auth required — this is called from an anonymous public page.
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
  const { visitorId, eventType = 'visit' } = body

  if (!visitorId || !['visit', 'ai_query'].includes(eventType)) {
    res.status(400).json({ error: 'invalid payload' })
    return
  }

  try {
    const admin = createAdminClient()
    await admin.from('klippies_events').insert({ visitor_id: visitorId, event_type: eventType })
    res.status(204).end()
  } catch {
    res.status(204).end() // fail silently — analytics must never break the user experience
  }
}
