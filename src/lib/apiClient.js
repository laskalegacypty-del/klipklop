import { supabase } from './supabaseClient'

export const USE_BFF = import.meta.env.VITE_USE_BFF === 'true'
export const USE_R2 = import.meta.env.VITE_USE_R2 === 'true'

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || ''
}

export async function api(path, { method, body, headers } = {}) {
  const token = await getAccessToken()
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const res = await fetch(path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      ...(isForm || !body ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || `API ${res.status}`)
    error.status = res.status
    error.data = data
    throw error
  }
  return data
}

function qs(query = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

function resource(path) {
  return {
    list: (query) => api(`/api/${path}${qs(query)}`),
    get: (id) => api(`/api/${path}/${id}`),
    create: (body) => api(`/api/${path}`, { method: 'POST', body }),
    update: (id, body) => api(`/api/${path}/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/api/${path}/${id}`, { method: 'DELETE' }),
  }
}

export const bff = {
  status: () => api('/api/bff'),
  me: {
    get: () => api('/api/me'),
    update: (body) => api('/api/me', { method: 'PATCH', body }),
  },
  horses: resource('horses'),
  combos: resource('combos'),
  medical: resource('medical'),
  reminders: resource('reminders'),
  vaccinations: resource('vaccinations'),
  videos: resource('videos'),
  notifications: resource('notifications'),
  bookmarks: resource('bookmarks'),
  results: resource('results'),
  pbs: resource('pbs'),
  events: resource('events'),
  announcements: resource('announcements'),
  profiles: resource('profiles'),
  friendships: resource('friendships'),
  messages: {
    list: (friendId, before) => api(`/api/messages${qs({ friendId, before })}`),
    send: (body) => api('/api/messages', { method: 'POST', body }),
    read: (friendId) => api('/api/messages/read', { method: 'POST', body: { friendId } }),
    unread: () => api('/api/messages/unread'),
    previews: (friendIds) => api(`/api/messages/previews${qs({ friendIds: friendIds.join(',') })}`),
  },
}

export function paystackVerifyUrl() {
  return USE_BFF
    ? '/api/paystack/verify'
    : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-paystack`
}

export function profileAccessEmailUrl() {
  return USE_BFF
    ? '/api/email/profile-access'
    : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-profile-access-request-email`
}
