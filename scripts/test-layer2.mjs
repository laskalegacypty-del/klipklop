// Layer 2 smoke tests: Cloudflare proxy + rules context payloads.
// Run: node scripts/test-layer2.mjs

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadDomain, searchDomain, buildDomainContext } from 'rules-engine/core'
import { wmg } from '../src/lib/rulesDomains/wmg.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envPath = join(root, '.env')

function loadEnv() {
  if (!existsSync(envPath)) throw new Error('.env not found — run env setup first')
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

async function postChat(payload) {
  const res = await fetch('http://localhost:3001/api/rules/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

function assert(label, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

loadEnv()

const tests = [
  {
    name: 'Rules + AI — barrel penalty',
    query: 'What is the penalty for knocking a barrel?',
    expectAi: true,
    expectInResponse: /5\s*second/i,
  },
  {
    name: 'Qualifier — Q3 games',
    query: 'What games are in Qualifier 3?',
    expectAi: true,
    expectInResponse: /poles|speedball|big t|fig/i,
  },
  {
    name: 'Personal data grounding',
    query: 'What are my personal bests?',
    riderData: 'Horse: TestHorse\nBarrel Race PB: 22.500s (Level 2)\nKeyhole PB: 8.100s (Level 3)',
    expectAi: true,
    expectInResponse: /22\.5|testhorse|keyhole/i,
  },
]

console.log('Waiting for local API server on :3001...')
for (let i = 0; i < 30; i++) {
  try {
    await fetch('http://localhost:3001/api/rules/chat', { method: 'OPTIONS' })
    break
  } catch {
    await new Promise(r => setTimeout(r, 500))
  }
  if (i === 29) {
    console.error('Local API server not reachable. Start with: npm run dev:layer2')
    process.exit(1)
  }
}

const rulesRaw = JSON.parse(
  readFileSync(join(root, 'public/data/wmg-rules.json'), 'utf8')
)
const testDomain = { ...wmg, loadRaw: () => rulesRaw, datasetUrl: undefined }
await loadDomain(testDomain)

for (const t of tests) {
  const rulesContext = buildDomainContext(testDomain, t.query)
  const context = [
    rulesContext,
    t.riderData ? `RIDER DATA (the signed-in rider's own KlipKlop records):\n${t.riderData}` : '',
  ].filter(Boolean).join('\n\n')
  const data = await postChat({
    query: t.query,
    context,
    systemPrompt: testDomain.ai.systemPrompt,
  })
  assert(`${t.name} — used_ai`, data.used_ai === t.expectAi, JSON.stringify(data))
  assert(
    `${t.name} — response content`,
    t.expectInResponse.test(data.response || ''),
    (data.response || '').slice(0, 120)
  )
}

// AI failure mode
const badToken = process.env.CF_API_TOKEN
process.env.CF_API_TOKEN = 'invalid-token-for-test'
// Re-import would be needed for handler to pick up bad token; test via direct CF call instead:
const accountId = process.env.CF_ACCOUNT_ID
const cfRes = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
  {
    method: 'POST',
    headers: {
      Authorization: 'Bearer invalid-token-for-test',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  }
)
const cfData = await cfRes.json()
process.env.CF_API_TOKEN = badToken
assert('AI failure mode — bad token rejected', cfData.success === false, cfData.errors?.[0]?.message)

// Offline rules retrieval (no API needed)
const citations = searchDomain(testDomain, 'barrel penalty', 2)
assert('Offline rules search', citations.length > 0, citations[0]?.title)

console.log(process.exitCode ? '\nSome tests failed.' : '\nAll Layer 2 tests passed.')
