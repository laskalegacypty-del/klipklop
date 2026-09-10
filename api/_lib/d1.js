// Optional D1 access for utilities-Worker dual-writes.
// On Vercel / local Node this is a no-op (no global env binding).

export function getD1() {
  return globalThis.__KK_ENV?.DB ?? null
}

function bindValue(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

export async function d1Insert(table, row) {
  const db = getD1()
  if (!db) return { ok: false, skipped: true }

  const cols = Object.keys(row).filter((key) => row[key] !== undefined)
  if (!cols.length) return { ok: false, skipped: true }

  const placeholders = cols.map(() => '?').join(', ')
  const sql = `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`

  try {
    await db.prepare(sql).bind(...cols.map((key) => bindValue(row[key]))).run()
    return { ok: true }
  } catch (err) {
    console.error(`[d1] insert ${table}:`, err?.message || err)
    return { ok: false, error: err }
  }
}

export function newId() {
  return crypto.randomUUID()
}

export function nowIso() {
  return new Date().toISOString()
}
