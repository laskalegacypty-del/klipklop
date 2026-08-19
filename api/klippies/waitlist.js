import { createAdminClient } from '../_lib/supabaseAdmin.js'
import { readJsonBody, sendJson } from '../_lib/http.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    sendJson(res, 500, { error: 'Waitlist is not configured' })
    return
  }

  if (req.method === 'GET') {
    const { count, error } = await admin
      .from('klippies_waitlist')
      .select('id', { count: 'exact', head: true })

    if (error) {
      sendJson(res, 500, { error: 'Could not load signup count' })
      return
    }
    sendJson(res, 200, { count: count || 0 })
    return
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    const name = String(body.name || '').trim()
    const surname = String(body.surname || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const phone = String(body.phone || '').trim()

    if (!name || !surname || !email || !phone) {
      sendJson(res, 400, { error: 'Name, surname, email and number are all required' })
      return
    }
    if (!EMAIL_RE.test(email)) {
      sendJson(res, 400, { error: 'Please enter a valid email address' })
      return
    }

    const { error: insertError } = await admin
      .from('klippies_waitlist')
      .insert({ name, surname, email, phone })

    if (insertError) {
      if (insertError.code === '23505') {
        sendJson(res, 409, { error: 'That email is already on the list' })
        return
      }
      sendJson(res, 500, { error: 'Could not save your signup, please try again' })
      return
    }

    const { count } = await admin
      .from('klippies_waitlist')
      .select('id', { count: 'exact', head: true })

    sendJson(res, 200, { ok: true, count: count || 0 })
    return
  }

  sendJson(res, 405, { error: 'Method not allowed' })
}
