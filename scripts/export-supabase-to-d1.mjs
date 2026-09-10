#!/usr/bin/env node
// Dump live Supabase tables into SQL for `wrangler d1 execute`.
// Usage: node scripts/export-supabase-to-d1.mjs
// Then: npx wrangler d1 execute klipklop --remote --file=scripts/.d1-export.sql -c workers/api/wrangler.toml

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envPath = join(root, '.env')
const outPath = join(__dirname, '.d1-export.sql')
const schemaPath = join(root, 'migrations/d1/0001_init.sql')

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

const TABLES = [
  'profiles',
  'horses',
  'horse_rider_combos',
  'qualifier_events',
  'qualifier_results',
  'personal_bests',
  'notifications',
  'announcements',
  'bookmarked_events',
  'club_member_links',
  'club_managed_riders',
  'supporter_rider_links',
  'user_friendships',
  'friend_reactions',
  'friend_messages',
  'horse_medical_entries',
  'horse_reminders',
  'vaccination_log',
  'horse_videos',
  'event_day_results',
  'event_day_sessions',
  'event_day_helper_times',
  'times_share_links',
  'push_subscriptions',
  'problem_reports',
  'klippies_waitlist',
  'klippies_access_requests',
  'klippies_events',
  'profile_access_grants',
  'staged_edit_sessions',
  'staged_edit_items',
  'horse_times',
]

const JSON_COLS = new Set([
  'attachment_meta',
  'entries',
  'selected_entry_keys',
  'payload',
  'context',
  'metadata',
  'notification_days_before',
  'extra',
])

function loadAllowedColumns() {
  const schema = readFileSync(schemaPath, 'utf8')
  const allowed = {}
  const tableRe = /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\);/g
  let match
  while ((match = tableRe.exec(schema))) {
    const cols = []
    for (const line of match[2].split('\n')) {
      const col = line.trim().match(/^(\w+)\s+/)
      if (!col) continue
      if (['CONSTRAINT', 'UNIQUE', 'PRIMARY', 'CHECK', 'FOREIGN'].includes(col[1].toUpperCase())) continue
      cols.push(col[1])
    }
    allowed[match[1]] = new Set(cols)
  }
  return allowed
}

function sqlLiteral(value, column) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'object' || JSON_COLS.has(column)) {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return `'${text.replaceAll("'", "''")}'`
  }
  return `'${String(value).replaceAll("'", "''")}'`
}

async function fetchAll(admin, table) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Need SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const allowed = loadAllowedColumns()
  const chunks = ['BEGIN;']
  let total = 0

  for (const table of TABLES) {
    let rows
    try {
      rows = await fetchAll(admin, table)
    } catch (err) {
      console.warn(`skip ${table}: ${err?.message || err}`)
      continue
    }
    if (!rows.length) {
      console.log(`${table}: 0 rows`)
      continue
    }

    const keep = allowed[table]
    chunks.push(`DELETE FROM ${table};`)
    for (const row of rows) {
      const cols = Object.keys(row).filter((col) => !keep || keep.has(col))
      if (!cols.length) continue
      const values = cols.map((col) => sqlLiteral(row[col], col))
      chunks.push(
        `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${values.join(', ')});`,
      )
    }
    total += rows.length
    console.log(`${table}: ${rows.length} rows`)
  }

  chunks.push('COMMIT;')
  writeFileSync(outPath, chunks.join('\n') + '\n')
  console.log(`Wrote ${total} rows to ${outPath}`)
  console.log('Apply with:')
  console.log('  npx wrangler d1 execute klipklop --remote --file=scripts/.d1-export.sql -c workers/api/wrangler.toml')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
