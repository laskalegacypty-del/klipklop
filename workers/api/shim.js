const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id, X-Paystack-Signature, apikey',
}

export { CORS }

export function applyEnv(env = {}) {
  globalThis.__KK_ENV = env
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') process.env[key] = value
  }
}

function headersToObject(headers) {
  const out = {}
  for (const [key, value] of headers.entries()) out[key.toLowerCase()] = value
  return out
}

export function makeMockReq(request, raw, query) {
  const headers = headersToObject(request.headers)
  const url = new URL(request.url)
  headers.host = headers.host || url.host
  headers['x-forwarded-host'] = headers['x-forwarded-host'] || url.host
  headers['x-forwarded-proto'] = headers['x-forwarded-proto'] || url.protocol.replace(':', '')

  let body = {}
  try { body = raw ? JSON.parse(raw) : {} } catch { body = {} }

  return {
    method: request.method,
    headers,
    query,
    body,
    rawBody: raw,
    url: url.pathname + url.search,
    on(event, cb) {
      if (event === 'data') cb(raw)
      if (event === 'end') cb()
    },
  }
}

export function invokeHandler(handler, request, raw, query) {
  return new Promise(async (resolve) => {
    let statusCode = 200
    let settled = false

    const finish = (response) => {
      if (settled) return
      settled = true
      resolve(response)
    }

    const mockRes = {
      statusCode: 200,
      status(code) {
        statusCode = code
        this.statusCode = code
        return this
      },
      json(obj) {
        finish(Response.json(obj, { status: statusCode, headers: CORS }))
      },
      end(body) {
        const init = { status: statusCode, headers: { ...CORS } }
        if (body == null || body === '') {
          finish(new Response(null, init))
          return
        }
        finish(new Response(String(body), init))
      },
    }

    try {
      await handler(makeMockReq(request, raw, query), mockRes)
      if (!settled) finish(new Response(null, { status: statusCode, headers: CORS }))
    } catch (err) {
      finish(Response.json(
        { error: err?.message || 'Handler error' },
        { status: 500, headers: CORS },
      ))
    }
  })
}

export function matchPath(pathname, pattern) {
  const keys = []
  const source = pattern.replace(/:([^/]+)/g, (_, key) => {
    keys.push(key)
    return '([^/]+)'
  })
  const match = pathname.match(new RegExp(`^${source}$`))
  if (!match) return null
  const params = {}
  keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]) })
  return params
}
