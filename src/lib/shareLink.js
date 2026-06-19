export async function createShareLink({ comboId, linkType, expiresInDays, accessToken }) {
  const res = await fetch('/api/share/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      combo_id: comboId,
      link_type: linkType,
      expires_in_days: expiresInDays,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Could not create share link')
  }
  return data
}

export async function fetchSharedTimes(token) {
  const res = await fetch(`/api/share/${encodeURIComponent(token)}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Could not load shared times')
    err.reason = data.reason
    err.status = res.status
    throw err
  }
  return data
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

export async function copyAndShare({ url, shareMessage, shareTitle }) {
  await copyText(url)

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: shareTitle || 'KlipKlop times',
        text: shareMessage || url,
        url,
      })
    } catch (err) {
      if (err?.name !== 'AbortError') {
        // User cancelled is fine; other errors fall through to clipboard-only.
      }
    }
  }
}

export function formatShareLinkExpiry(link) {
  if (!link?.expires_at) return 'No expiry'
  return new Date(link.expires_at).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function isShareLinkActive(link) {
  if (!link || link.revoked_at) return false
  if (link.expires_at && new Date(link.expires_at) < new Date()) return false
  if (link.view_count >= link.max_views) return false
  return true
}
