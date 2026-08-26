// Submit a user-reported problem (incorrect info, bug, or UI issue).
// Uses the service-role client so unauthenticated visitors (e.g. on the
// public Klippies page) can report too, not just logged-in app users.
import { createAdminClient } from '../_lib/supabaseAdmin.js'

const CATEGORIES = ['incorrect_info', 'bug', 'ui_problem', 'other']
const MAX_DESCRIPTION = 2000

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
  const category = String(body.category || '').trim()
  const description = String(body.description || '').trim()

  if (!CATEGORIES.includes(category)) {
    res.status(400).json({ error: 'Invalid category' })
    return
  }
  if (!description) {
    res.status(400).json({ error: 'Description is required' })
    return
  }
  if (description.length > MAX_DESCRIPTION) {
    res.status(400).json({ error: `Description must be under ${MAX_DESCRIPTION} characters` })
    return
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('problem_reports')
    .insert({
      category,
      description: description.slice(0, MAX_DESCRIPTION),
      page_path: String(body.pagePath || '').slice(0, 300) || null,
      user_id: body.userId ? String(body.userId) : null,
      reporter_name: String(body.reporterName || '').trim().slice(0, 200) || null,
      reporter_email: String(body.reporterEmail || '').trim().slice(0, 320) || null,
      visitor_id: String(body.visitorId || '').slice(0, 200) || null,
      context: body.context && typeof body.context === 'object' ? body.context : null,
      user_agent: String(body.userAgent || '').slice(0, 500) || null,
    })
    .select('id')
    .single()

  if (error) {
    res.status(500).json({ error: 'Failed to submit report' })
    return
  }

  res.json({ success: true, id: data.id })
}
