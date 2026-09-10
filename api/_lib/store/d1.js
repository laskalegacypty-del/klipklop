import { RESOURCES } from '../catalog.js'
import { getD1, newId, nowIso } from '../d1.js'

const TABLE_SPECS = new Map(
  Object.values(RESOURCES).map((spec) => [spec.table, spec]),
)

function ident(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(String(name || ''))) {
    throw new Error('Invalid identifier')
  }
  return name
}

function specOf(table) {
  return TABLE_SPECS.get(table) || { jsonCols: [], boolCols: [] }
}

function coerceRead(row, spec = {}) {
  if (!row) return row
  const out = { ...row }
  for (const col of spec.jsonCols || []) {
    if (typeof out[col] === 'string' && out[col]) {
      try { out[col] = JSON.parse(out[col]) } catch { /* keep string */ }
    }
  }
  for (const col of spec.boolCols || []) {
    if (out[col] === 0 || out[col] === 1) out[col] = Boolean(out[col])
  }
  return out
}

function coerceWrite(row, spec = {}) {
  const out = { ...row }
  for (const col of spec.jsonCols || []) {
    if (out[col] !== undefined && typeof out[col] !== 'string') {
      out[col] = JSON.stringify(out[col])
    }
  }
  for (const col of spec.boolCols || []) {
    if (typeof out[col] === 'boolean') out[col] = out[col] ? 1 : 0
  }
  return out
}

function bindEq(opts = {}) {
  const where = []
  const values = []
  if (opts.eq) {
    for (const [key, value] of Object.entries(opts.eq)) {
      if (value === undefined || value === '') continue
      where.push(`${ident(key)} = ?`)
      values.push(value)
    }
  }
  if (opts.is) {
    for (const [key, value] of Object.entries(opts.is)) {
      ident(key)
      if (value === null) where.push(`${key} IS NULL`)
    }
  }
  if (opts.in) {
    for (const [key, value] of Object.entries(opts.in)) {
      if (!Array.isArray(value) || !value.length) continue
      ident(key)
      where.push(`${key} IN (${value.map(() => '?').join(', ')})`)
      values.push(...value)
    }
  }
  if (opts.lt) {
    for (const [key, value] of Object.entries(opts.lt)) {
      where.push(`${ident(key)} < ?`)
      values.push(value)
    }
  }
  return { where, values }
}

export function createD1Store() {
  const db = getD1()
  if (!db) throw new Error('D1 is not bound')

  return {
    backend: 'd1',
    async getById(table, id) {
      const spec = specOf(table)
      const row = await db.prepare(`SELECT * FROM ${ident(table)} WHERE id = ?`).bind(id).first()
      return coerceRead(row, spec)
    },
    async list(table, opts = {}) {
      const spec = specOf(table)
      const { where, values } = bindEq(opts)
      let sql = `SELECT * FROM ${ident(table)}`
      if (where.length) sql += ` WHERE ${where.join(' AND ')}`
      if (opts.order?.column) {
        sql += ` ORDER BY ${ident(opts.order.column)} ${opts.order.ascending === false ? 'DESC' : 'ASC'}`
      }
      if (opts.limit) sql += ` LIMIT ${Number(opts.limit)}`
      const { results } = await db.prepare(sql).bind(...values).all()
      const rows = (results || []).map((row) => coerceRead(row, spec))
      return opts.single ? (rows[0] || null) : rows
    },
    async insert(table, row) {
      const spec = specOf(table)
      const payload = coerceWrite({
        id: row.id || newId(),
        created_at: row.created_at || nowIso(),
        ...row,
      }, spec)
      const cols = Object.keys(payload).filter((key) => payload[key] !== undefined)
      const sql = `INSERT INTO ${ident(table)} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
      await db.prepare(sql).bind(...cols.map((key) => payload[key] ?? null)).run()
      return coerceRead(payload, spec)
    },
    async update(table, patch, filters = {}) {
      const spec = specOf(table)
      const payload = coerceWrite(patch, spec)
      const cols = Object.keys(payload).filter((key) => payload[key] !== undefined)
      if (!cols.length) return []
      const { where, values } = bindEq(filters)
      if (!where.length) throw new Error('Refusing unfiltered D1 update')
      const sql = `UPDATE ${ident(table)} SET ${cols.map((key) => `${ident(key)} = ?`).join(', ')} WHERE ${where.join(' AND ')}`
      await db.prepare(sql).bind(...cols.map((key) => payload[key] ?? null), ...values).run()
      return this.list(table, filters)
    },
    async remove(table, filters = {}) {
      const existing = await this.list(table, filters)
      const { where, values } = bindEq(filters)
      if (!where.length) throw new Error('Refusing unfiltered D1 delete')
      await db.prepare(`DELETE FROM ${ident(table)} WHERE ${where.join(' AND ')}`).bind(...values).run()
      return existing
    },
    async upsert(table, row, { onConflict } = {}) {
      const spec = specOf(table)
      const payload = coerceWrite({
        id: row.id || newId(),
        ...row,
      }, spec)
      const cols = Object.keys(payload).filter((key) => payload[key] !== undefined)
      const conflict = onConflict
        ? ident(String(onConflict).split(',')[0].trim())
        : 'id'
      const updates = cols.filter((key) => key !== conflict).map((key) => `${ident(key)} = excluded.${ident(key)}`)
      const sql = `INSERT INTO ${ident(table)} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
        ON CONFLICT(${conflict}) DO UPDATE SET ${updates.join(', ')}`
      await db.prepare(sql).bind(...cols.map((key) => payload[key] ?? null)).run()
      return [coerceRead(payload, spec)]
    },
  }
}
