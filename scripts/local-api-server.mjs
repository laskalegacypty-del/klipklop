// Local /api/* server. Prefer `npm run dev:worker-api` (wrangler) when you need D1/AI/R2.
// This Node wrapper uses the same Worker router without Cloudflare bindings.

import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { handleApi, applyEnv } from '../workers/api/routes.js'

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

applyEnv({ ...process.env })

const PORT = Number(process.env.LOCAL_API_PORT || 3001)

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value))
  }

  const method = req.method || 'GET'
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const request = new Request(url, {
    method,
    headers,
    body: hasBody ? raw : undefined,
  })

  try {
    const response = await handleApi(request, { ...process.env })
    const outHeaders = {}
    response.headers.forEach((value, key) => { outHeaders[key] = value })
    res.writeHead(response.status, outHeaders)
    const buf = Buffer.from(await response.arrayBuffer())
    res.end(buf)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err?.message || 'Handler error' }))
  }
})

server.listen(PORT, () => {
  console.log(`Local API server listening on http://localhost:${PORT}`)
})
