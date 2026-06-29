export const ACTIVE_SESSION_KEY = 'event-day:active-session'

export function getOrCreateDeviceId() {
  const key = 'event-day-device-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export function getHelperLabel(token) {
  return localStorage.getItem(`event-day-helper-label:${token}`) || ''
}

export function setHelperLabel(token, label) {
  if (label) {
    localStorage.setItem(`event-day-helper-label:${token}`, label)
  } else {
    localStorage.removeItem(`event-day-helper-label:${token}`)
  }
}

export function loadHelperLocalTimes(token, deviceId) {
  try {
    const raw = localStorage.getItem(`event-day-helper:${token}:${deviceId}`)
    if (!raw) return { enteredTimes: {}, helperLabel: getHelperLabel(token) }
    const parsed = JSON.parse(raw)
    return {
      enteredTimes: parsed.enteredTimes || {},
      helperLabel: parsed.helperLabel || getHelperLabel(token),
    }
  } catch {
    return { enteredTimes: {}, helperLabel: getHelperLabel(token) }
  }
}

export function saveHelperLocalTimes(token, deviceId, enteredTimes, helperLabel) {
  try {
    localStorage.setItem(`event-day-helper:${token}:${deviceId}`, JSON.stringify({
      enteredTimes,
      helperLabel,
    }))
    if (helperLabel) setHelperLabel(token, helperLabel)
  } catch { /* ignore */ }
}

export async function createEventDaySession(payload, accessToken) {
  const res = await fetch('/api/event-day/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not create helper link')
  return data
}

export async function fetchEventDaySession(token) {
  const res = await fetch(`/api/event-day/session/${encodeURIComponent(token)}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Could not load session')
    err.reason = data.reason
    err.status = res.status
    throw err
  }
  return data
}

export async function syncHelperTimes(token, { times, helperLabel, deviceId }) {
  const res = await fetch(`/api/event-day/${encodeURIComponent(token)}/times`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId,
    },
    body: JSON.stringify({ times, helper_label: helperLabel || null }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not sync times')
  return data
}

export async function fetchHelperContributions(token, accessToken) {
  const res = await fetch(`/api/event-day/${encodeURIComponent(token)}/times`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not load helper times')
  return data
}

export async function revokeEventDaySession(token, accessToken) {
  const res = await fetch(`/api/event-day/session/${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not revoke link')
  return data
}

/** Merge helper rows into enteredTimes; organizer values win on conflict. */
export function mergeHelperContributions(enteredTimes, contributions, entryKeyFilter = null) {
  const next = { ...enteredTimes }

  for (const row of contributions) {
    if (entryKeyFilter && row.entry_key !== entryKeyFilter) continue

    const key = row.entry_key
    const eventId = row.event_id
    const game = row.game

    const existing = next[key]?.[eventId]?.[game]
    const hasOrganizer = existing && (existing.is_nt || (existing.time && existing.time.trim() !== ''))
    if (hasOrganizer) continue

    if (!next[key]) next[key] = {}
    if (!next[key][eventId]) next[key][eventId] = {}

    next[key][eventId][game] = {
      time: row.is_nt ? '' : (row.time != null ? String(row.time) : ''),
      is_nt: Boolean(row.is_nt),
    }
  }

  return next
}
