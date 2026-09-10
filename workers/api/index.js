// Utilities Worker: existing Vercel-style /api handlers behind a Fetch shim.
// Secrets live here (not on the SPA Worker). D1 is bound as env.DB.

import chatHandler from '../../api/rules/chat.js'
import shareCreateHandler from '../../api/share/create.js'
import shareTokenHandler from '../../api/share/[token].js'
import klippiesWaitlistHandler from '../../api/klippies/waitlist.js'
import klippiesRequestHandler from '../../api/klippies/request.js'
import klippiesLogHandler from '../../api/klippies/log.js'
import klippiesCheckHandler from '../../api/klippies/check.js'
import reportsCreateHandler from '../../api/reports/create.js'
import eventDaySessionHandler from '../../api/event-day/session.js'
import eventDaySessionTokenHandler from '../../api/event-day/session/[token].js'
import eventDayTimesHandler from '../../api/event-day/[token]/times.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id',
}

function applyEnv(env) {
  globalThis.__KK_ENV = env
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') process.env[key] = value
  }
}

function headersToObject(headers) {
  const out = {}
  for (const [key, value] of headers.entries()) {
    out[key.toLowerCase()] = value
  }
  return out
}

function makeMockReq(request, raw, query) {
  const headers = headersToObject(request.headers)
  const url = new URL(request.url)
  headers.host = headers.host || url.host
  headers['x-forwarded-host'] = headers['x-forwarded-host'] || url.host
  headers['x-forwarded-proto'] = headers['x-forwarded-proto'] || url.protocol.replace(':', '')

  let body = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    body = {}
  }

  return {
    method: request.method,
    headers,
    query,
    body,
    url: url.pathname + url.search,
    on(event, cb) {
      if (event === 'data') cb(raw)
      if (event === 'end') cb()
    },
  }
}

function invokeHandler(handler, request, raw, query) {
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

function matchToken(pathname, pattern) {
  const source = pattern.replace(/:[^/]+/g, '([^/]+)')
  const match = pathname.match(new RegExp(`^${source}$`))
  return match ? decodeURIComponent(match[1]) : null
}

async function route(request) {
  const url = new URL(request.url)
  const { pathname } = url
  const method = request.method
  const raw = method === 'GET' || method === 'HEAD' ? '' : await request.text()

  if (pathname === '/api/health' && method === 'GET') {
    return Response.json({ ok: true, service: 'klipklop-api' }, { headers: CORS })
  }

  if (pathname === '/api/rules/chat' && method === 'POST') {
    return invokeHandler(chatHandler, request, raw, {})
  }
  if (pathname === '/api/share/create' && method === 'POST') {
    return invokeHandler(shareCreateHandler, request, raw, {})
  }
  if (pathname === '/api/klippies/waitlist' && (method === 'GET' || method === 'POST')) {
    return invokeHandler(klippiesWaitlistHandler, request, raw, {})
  }
  if (pathname === '/api/klippies/request' && method === 'POST') {
    return invokeHandler(klippiesRequestHandler, request, raw, {})
  }
  if (pathname === '/api/klippies/log' && method === 'POST') {
    return invokeHandler(klippiesLogHandler, request, raw, {})
  }
  if (pathname === '/api/klippies/check' && method === 'POST') {
    return invokeHandler(klippiesCheckHandler, request, raw, {})
  }
  if (pathname === '/api/reports/create' && method === 'POST') {
    return invokeHandler(reportsCreateHandler, request, raw, {})
  }
  if (pathname === '/api/event-day/session' && method === 'POST') {
    return invokeHandler(eventDaySessionHandler, request, raw, {})
  }

  const shareToken = matchToken(pathname, '/api/share/:token')
  if (shareToken && (method === 'GET' || method === 'DELETE')) {
    return invokeHandler(shareTokenHandler, request, raw, { token: shareToken })
  }

  const sessionToken = matchToken(pathname, '/api/event-day/session/:token')
  if (sessionToken && (method === 'GET' || method === 'DELETE')) {
    return invokeHandler(eventDaySessionTokenHandler, request, raw, { token: sessionToken })
  }

  const timesToken = matchToken(pathname, '/api/event-day/:token/times')
  if (timesToken && (method === 'GET' || method === 'PUT')) {
    return invokeHandler(eventDayTimesHandler, request, raw, { token: timesToken })
  }

  return Response.json({ error: 'Not found' }, { status: 404, headers: CORS })
}

export default {
  async fetch(request, env) {
    applyEnv(env)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }
    return route(request)
  },
}
