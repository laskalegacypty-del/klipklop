#!/usr/bin/env node
// After the service role key is in workers/api/.dev.vars:
//   npm run go-live
// Puts the secret, points PUBLIC_APP_URL at the apex, deploys the SPA Worker
// with klipklop.co.za + www attached. Live Vercel DNS is replaced.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args, opts = {}) {
  const stdio = opts.input ? ['pipe', 'inherit', 'inherit'] : 'inherit'
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio,
    shell: false,
    ...opts,
  })
  if (result.status !== 0) process.exit(result.status || 1)
}

console.log('1/4  Service role → klipklop-api')
run('node', ['scripts/put-service-role.mjs'])

console.log('2/4  PUBLIC_APP_URL=https://klipklop.co.za')
run('npx', ['wrangler', 'secret', 'put', 'PUBLIC_APP_URL', '-c', 'workers/api/wrangler.toml'], {
  input: 'https://klipklop.co.za',
})

console.log('3/4  Build SPA with .env.cf-build')
run('bash', ['-lc', 'set -a && . ./.env.cf-build && set +a && npm run build'])

console.log('4/4  Deploy SPA Worker + attach klipklop.co.za / www')
run('npx', ['wrangler', 'deploy', '-c', 'wrangler.apex.toml'])

const urls = [
  'https://klipklop.co.za/api/health',
  'https://www.klipklop.co.za/api/health',
]
for (const url of urls) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    const text = await res.text()
    console.log(url, res.status, text.slice(0, 120))
  } catch (err) {
    console.error(url, 'failed:', err.message)
    process.exit(1)
  }
}

console.log('Live on Cloudflare. Leave Vercel up a few days, then remove its DNS records if any remain.')
