import { readJsonBody, sendJson } from '../_lib/http.js'
import { getResource } from '../_lib/catalog.js'
import { getStore } from '../_lib/store.js'
import { pick, requireCaller } from '../_lib/session.js'

export async function handleMe(req, res) {
  const caller = await requireCaller(req, res)
  if (!caller) return

  const store = getStore(caller.token)

  try {
    if (req.method === 'GET') {
      sendJson(res, 200, { data: caller.profile })
      return
    }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = await readJsonBody(req)
      const spec = getResource('profiles')
      const patch = pick(body, spec.patchAllow)
      const data = await store.update('profiles', patch, { eq: { id: caller.user.id } })
      sendJson(res, 200, { data: Array.isArray(data) ? data[0] : data })
      return
    }
    sendJson(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    sendJson(res, 500, { error: err?.message || 'Profile error' })
  }
}
