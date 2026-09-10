#!/usr/bin/env node
// Read SUPABASE_SERVICE_ROLE_KEY from workers/api/.dev.vars (or env) and
// put it on klipklop-api. Never prints the key.

import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const devVars = join(root, 'workers/api/.dev.vars')

function loadKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
  }
  if (!existsSync(devVars)) {
    throw new Error(`Missing ${devVars}. Add SUPABASE_SERVICE_ROLE_KEY=... there.`)
  }
  for (const line of readFileSync(devVars, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) continue
    return trimmed.slice('SUPABASE_SERVICE_ROLE_KEY='.length).trim().replace(/^['"]|['"]$/g, '')
  }
  return ''
}

function jwtRole(token) {
  const part = token.split('.')[1]
  if (!part) return null
  const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  return JSON.parse(json).role || null
}

const key = loadKey()
if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is empty.')
  console.error('Paste it into workers/api/.dev.vars then re-run: npm run secret:service-role')
  process.exit(1)
}

let role
try {
  role = jwtRole(key)
} catch {
  console.error('That value is not a JWT. Copy service_role from Supabase → Settings → API.')
  process.exit(1)
}

if (role === 'anon') {
  console.error('That is the anon key. Need service_role (the secret one).')
  process.exit(1)
}
if (role !== 'service_role') {
  console.error(`JWT role is "${role}", expected service_role.`)
  process.exit(1)
}

console.log(`Putting SUPABASE_SERVICE_ROLE_KEY on klipklop-api (${key.length} chars, role=${role})…`)
const put = spawnSync(
  'npx',
  ['wrangler', 'secret', 'put', 'SUPABASE_SERVICE_ROLE_KEY', '-c', 'workers/api/wrangler.toml'],
  { cwd: root, input: key, stdio: ['pipe', 'inherit', 'inherit'] },
)
if (put.status !== 0) process.exit(put.status || 1)

const check = await fetch('https://klipklop.klipklop.workers.dev/api/bff')
const body = await check.json()
if (!body?.secrets?.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('/api/bff still reports the secret as missing. Wait a few seconds and curl it again.')
  process.exit(1)
}

const probe = await fetch('https://klipklop.klipklop.workers.dev/api/klippies/check', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'cutover-probe@klipklop.co.za' }),
})
const probeBody = await probe.json().catch(() => ({}))
if (probe.status >= 500) {
  console.error('Klippies check still 500:', probeBody)
  process.exit(1)
}

console.log('Service role is live. Klippies check:', probe.status, probeBody)
