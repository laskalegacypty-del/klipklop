import { applyEnv, CORS, invokeHandler, matchPath } from './shim.js'
import { RESOURCE_PATHS } from '../../api/_lib/catalog.js'
import { handleStatus } from '../../api/bff/status.js'
import { handleMe } from '../../api/bff/me.js'
import { handleResource } from '../../api/bff/crud.js'
import { handleMessages } from '../../api/bff/messages.js'
import { handleMedia } from '../../api/bff/uploads.js'
import { handlePaystackVerify, handlePaystackWebhook } from '../../api/paystack/handlers.js'
import { handleApprovalEmail, handleProfileAccessEmail } from '../../api/email/handlers.js'
import { handlePushSend } from '../../api/push/send.js'

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

export { applyEnv, CORS }

const RESOURCE_SET = new Set(RESOURCE_PATHS)

async function route(request, env) {
  const url = new URL(request.url)
  const { pathname } = url
  const method = request.method

  const media = await handleMedia(request, env || globalThis.__KK_ENV || {})
  if (media) return media

  if (pathname === '/api/paystack/webhook') return handlePaystackWebhook(request)
  if (pathname === '/api/paystack/verify') return handlePaystackVerify(request)
  if (pathname === '/api/email/approval') return handleApprovalEmail(request)
  if (pathname === '/api/email/profile-access') return handleProfileAccessEmail(request)
  if (pathname === '/api/push/send') return handlePushSend(request)

  const raw = method === 'GET' || method === 'HEAD' ? '' : await request.clone().text()

  if (pathname === '/api/health' && method === 'GET') {
    return Response.json({ ok: true, service: 'klipklop-api' }, { headers: CORS })
  }
  if (pathname === '/api/bff' && method === 'GET') {
    return invokeHandler(handleStatus, request, raw, {})
  }
  if (pathname === '/api/me') {
    return invokeHandler(handleMe, request, raw, {})
  }
  if (pathname === '/api/messages/unread') {
    return invokeHandler((req, res) => handleMessages(req, res, 'unread'), request, raw, {})
  }
  if (pathname === '/api/messages/previews') {
    return invokeHandler((req, res) => handleMessages(req, res, 'previews'), request, raw, {})
  }
  if (pathname === '/api/messages/read') {
    return invokeHandler((req, res) => handleMessages(req, res, 'read'), request, raw, {})
  }
  if (pathname === '/api/messages') {
    return invokeHandler((req, res) => handleMessages(req, res), request, raw, {})
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

  const shareToken = matchPath(pathname, '/api/share/:token')
  if (shareToken && (method === 'GET' || method === 'DELETE')) {
    return invokeHandler(shareTokenHandler, request, raw, { token: shareToken.token })
  }

  const sessionToken = matchPath(pathname, '/api/event-day/session/:token')
  if (sessionToken && (method === 'GET' || method === 'DELETE')) {
    return invokeHandler(eventDaySessionTokenHandler, request, raw, { token: sessionToken.token })
  }

  const timesToken = matchPath(pathname, '/api/event-day/:token/times')
  if (timesToken && (method === 'GET' || method === 'PUT')) {
    return invokeHandler(eventDayTimesHandler, request, raw, { token: timesToken.token })
  }

  const one = matchPath(pathname, '/api/:resource/:id')
  if (one && RESOURCE_SET.has(one.resource)) {
    return invokeHandler((req, res) => handleResource(req, res, one.resource, one.id), request, raw, { id: one.id })
  }
  const list = matchPath(pathname, '/api/:resource')
  if (list && RESOURCE_SET.has(list.resource)) {
    return invokeHandler((req, res) => handleResource(req, res, list.resource), request, raw, {})
  }

  return Response.json({ error: 'Not found' }, { status: 404, headers: CORS })
}

export async function handleApi(request, env) {
  if (env) applyEnv(env)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  return route(request, env)
}
