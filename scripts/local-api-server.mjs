// Minimal local server for /api/* routes when `vercel dev` is unavailable.
// Used by `npm run dev:layer2` (Vite proxies /api → this server).

import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import chatHandler from '../api/rules/chat.js'
import shareCreateHandler from '../api/share/create.js'
import shareTokenHandler from '../api/share/[token].js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envPath = join(root, '.env')

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

const PORT = Number(process.env.LOCAL_API_PORT || 3001)

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

function makeMockReq(req, raw, query = {}) {
  let body = {}
  try { body = raw ? JSON.parse(raw) : {} } catch { /* ignore */ }

  return {
    method: req.method,
    headers: req.headers,
    query,
    body,
    on(event, cb) {
      if (event === 'data') cb(raw)
      if (event === 'end') cb()
    },
  }
}

function makeMockRes(res) {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(obj) { sendJson(res, this.statusCode, obj) },
    end() { res.end() },
  }
}

async function invokeHandler(handler, req, res, raw, query) {
  const mockReq = makeMockReq(req, raw, query)
  const mockRes = makeMockRes(res)
  try {
    await handler(mockReq, mockRes)
  } catch (err) {
    sendJson(res, 500, { error: err?.message || 'Handler error' })
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const raw = await readRawBody(req)

  if (url.pathname === '/api/rules/chat' && req.method === 'POST') {
    await invokeHandler(chatHandler, req, res, raw)
    return
  }

  if (url.pathname === '/api/share/create' && req.method === 'POST') {
    await invokeHandler(shareCreateHandler, req, res, raw)
    return
  }

  const shareMatch = url.pathname.match(/^\/api\/share\/([^/]+)$/)
  if (shareMatch && (req.method === 'GET' || req.method === 'DELETE')) {
    await invokeHandler(shareTokenHandler, req, res, raw, { token: decodeURIComponent(shareMatch[1]) })
    return
  }

  sendJson(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`Local API server listening on http://localhost:${PORT}`)
})
