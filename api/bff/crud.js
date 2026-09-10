import { readJsonBody, sendJson } from '../_lib/http.js'
import { getResource } from '../_lib/catalog.js'
import { dataBackend, getStore } from '../_lib/store.js'
import { pick, requireAdmin, requireCaller } from '../_lib/session.js'

const RESERVED_QUERY = new Set(['limit', 'order', 'ascending', 'select'])

function queryFilters(spec, url) {
  const eq = {}
  const allow = new Set([
    ...(spec.filterCols || []),
    spec.ownerCol,
    spec.ownerVia?.localKey,
    'id',
  ].filter(Boolean))

  for (const [key, value] of url.searchParams.entries()) {
    if (RESERVED_QUERY.has(key) || value === '') continue
    if (allow.has(key)) eq[key] = value === 'true' ? true : value === 'false' ? false : value
  }
  return eq
}

function listOpts(spec, url) {
  const orderCol = url.searchParams.get('order') || 'created_at'
  const ascending = url.searchParams.get('ascending') !== 'false'
  const limit = url.searchParams.get('limit')
  return {
    eq: queryFilters(spec, url),
    order: { column: orderCol, ascending },
    limit: limit ? Number(limit) : undefined,
    select: url.searchParams.get('select') || '*',
  }
}

async function assertCanAccess(store, spec, caller, row) {
  if (dataBackend() === 'supabase') return true
  if (caller.isAdmin) return true
  if (!row) return false
  if (spec.ownerCol && row[spec.ownerCol] === caller.user.id) return true
  if (spec.ownerVia) {
    const parent = await store.getById(spec.ownerVia.table, row[spec.ownerVia.localKey])
    return parent?.[spec.ownerVia.ownerCol] === caller.user.id
  }
  if (spec.publicRead) return true
  return false
}

function filterPatch(spec, caller, body) {
  if (caller.isAdmin && spec.adminPatchAllow) return pick(body, spec.adminPatchAllow)
  if (spec.patchAllow) return pick(body, spec.patchAllow)
  const blocked = new Set(['id', spec.ownerCol, 'created_at'].filter(Boolean))
  const out = {}
  for (const [key, value] of Object.entries(body || {})) {
    if (!blocked.has(key)) out[key] = value
  }
  return out
}

export async function handleResource(req, res, name, id) {
  const spec = getResource(name)
  if (!spec) {
    sendJson(res, 404, { error: 'Unknown resource' })
    return
  }

  if (dataBackend() === 'd1' && spec.d1Ready === false) {
    sendJson(res, 501, {
      error: 'This resource still uses Supabase RLS; D1 access rules are not implemented yet',
      resource: name,
    })
    return
  }

  const method = req.method
  if (method === 'GET' && spec.listAdminOnly && !id) {
    const caller = await requireAdmin(req, res)
    if (!caller) return
    return listResource(req, res, spec, caller)
  }

  const caller = spec.adminWrite && method !== 'GET'
    ? await requireAdmin(req, res)
    : await requireCaller(req, res)
  if (!caller) return

  const store = getStore(caller.token)

  try {
    if (method === 'GET' && !id) return await listResource(req, res, spec, caller, store)
    if (method === 'GET' && id) return await getOne(res, spec, caller, store, id)
    if (method === 'POST') return await createOne(req, res, spec, caller, store)
    if ((method === 'PATCH' || method === 'PUT') && id) return await patchOne(req, res, spec, caller, store, id)
    if (method === 'DELETE' && id) return await deleteOne(res, spec, caller, store, id)
    sendJson(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    sendJson(res, 500, { error: err?.message || 'Resource error' })
  }
}

async function listResource(req, res, spec, caller, store) {
  const db = store || getStore(caller.token)
  const url = new URL(req.url, 'https://klipklop.local')
  const opts = listOpts(spec, url)
  if (spec.ownerCol && !caller.isAdmin && !opts.eq[spec.ownerCol] && dataBackend() === 'd1') {
    opts.eq[spec.ownerCol] = caller.user.id
  }
  const data = await db.list(spec.table, opts)
  sendJson(res, 200, { data })
}

async function getOne(res, spec, caller, store, id) {
  const row = await store.getById(spec.table, id)
  if (!row) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }
  if (!(await assertCanAccess(store, spec, caller, row))) {
    sendJson(res, 403, { error: 'Forbidden' })
    return
  }
  sendJson(res, 200, { data: row })
}

async function createOne(req, res, spec, caller, store) {
  if (spec.allowInsert === false) {
    sendJson(res, 405, { error: 'Insert not allowed' })
    return
  }
  const body = await readJsonBody(req)
  const row = { ...body }
  if (spec.ownerCol && !caller.isAdmin) row[spec.ownerCol] = caller.user.id
  const data = await store.insert(spec.table, row)
  sendJson(res, 201, { data })
}

async function patchOne(req, res, spec, caller, store, id) {
  const existing = await store.getById(spec.table, id)
  if (!existing) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }
  if (!(await assertCanAccess(store, spec, caller, existing))) {
    sendJson(res, 403, { error: 'Forbidden' })
    return
  }
  const body = await readJsonBody(req)
  const patch = filterPatch(spec, caller, body)
  const data = await store.update(spec.table, patch, { eq: { id } })
  sendJson(res, 200, { data: Array.isArray(data) ? data[0] : data })
}

async function deleteOne(res, spec, caller, store, id) {
  if (spec.allowDelete === false) {
    sendJson(res, 405, { error: 'Delete not allowed' })
    return
  }
  const existing = await store.getById(spec.table, id)
  if (!existing) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }
  if (!(await assertCanAccess(store, spec, caller, existing))) {
    sendJson(res, 403, { error: 'Forbidden' })
    return
  }
  await store.remove(spec.table, { eq: { id } })
  sendJson(res, 200, { data: existing })
}
