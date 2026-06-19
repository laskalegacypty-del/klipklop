// Layer 2 dev: local API server + Vite (proxies /api → :3001).
// Equivalent to `vercel dev` for testing the Assistant without Vercel CLI login.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function run(cmd, args, label) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
  child.on('exit', code => {
    if (code !== 0 && code !== null) console.error(`${label} exited with code ${code}`)
  })
  return child
}

console.log('Starting Layer 2 dev (local API + Vite proxy)...')
console.log('Open http://localhost:5173 — sign in → Assistant')
console.log('(Or use `npx vercel dev` after `npx vercel login` for the official Vercel dev server.)\n')

const api = run('node', ['scripts/local-api-server.mjs'], 'API')
const vite = run('npx', ['vite'], 'Vite')

function shutdown() {
  api.kill()
  vite.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
