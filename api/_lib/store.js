import { createSupabaseStore } from './store/supabase.js'
import { createD1Store } from './store/d1.js'

export function dataBackend() {
  const value = String(process.env.DATA_BACKEND || 'supabase').toLowerCase()
  return value === 'd1' ? 'd1' : 'supabase'
}

export function getStore(token) {
  if (dataBackend() === 'd1') return createD1Store()
  return createSupabaseStore(token)
}
