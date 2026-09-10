import { createAuthedClient, createAdminClient } from '../supabaseAdmin.js'

function applyFilters(query, opts = {}) {
  let q = query
  if (opts.eq) {
    for (const [key, value] of Object.entries(opts.eq)) {
      if (value !== undefined && value !== null && value !== '') q = q.eq(key, value)
    }
  }
  if (opts.in) {
    for (const [key, value] of Object.entries(opts.in)) {
      if (Array.isArray(value) && value.length) q = q.in(key, value)
    }
  }
  if (opts.is) {
    for (const [key, value] of Object.entries(opts.is)) q = q.is(key, value)
  }
  if (opts.lt) {
    for (const [key, value] of Object.entries(opts.lt)) q = q.lt(key, value)
  }
  if (opts.or) q = q.or(opts.or)
  if (opts.order) {
    q = q.order(opts.order.column, { ascending: opts.order.ascending !== false })
  }
  if (opts.limit) q = q.limit(Number(opts.limit))
  return q
}

function wrap(sb) {
  return {
    backend: 'supabase',
    async getById(table, id, select = '*') {
      const { data, error } = await sb.from(table).select(select).eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
    async list(table, opts = {}) {
      let q = applyFilters(sb.from(table).select(opts.select || '*'), opts)
      if (opts.single) {
        const { data, error } = await q.maybeSingle()
        if (error) throw error
        return data
      }
      const { data, error } = await q
      if (error) throw error
      return data
    },
    async insert(table, row, { select = '*' } = {}) {
      const { data, error } = await sb.from(table).insert(row).select(select).single()
      if (error) throw error
      return data
    },
    async update(table, patch, filters = {}) {
      const q = applyFilters(sb.from(table).update(patch), filters)
      const { data, error } = await q.select()
      if (error) throw error
      return data
    },
    async remove(table, filters = {}) {
      const q = applyFilters(sb.from(table).delete(), filters)
      const { data, error } = await q.select()
      if (error) throw error
      return data
    },
    async upsert(table, row, { onConflict, select = '*' } = {}) {
      const { data, error } = await sb
        .from(table)
        .upsert(row, onConflict ? { onConflict } : {})
        .select(select)
      if (error) throw error
      return data
    },
  }
}

export function createSupabaseStore(token) {
  return wrap(createAuthedClient(token))
}

export function createSupabaseAdminStore() {
  return wrap(createAdminClient())
}
