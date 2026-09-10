export function cn(...values) {
  const tokens = values
    .flatMap((v) => {
      if (!v) return []
      if (Array.isArray(v)) return v
      if (typeof v === 'object') {
        return Object.entries(v)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([klass]) => klass)
      }
      return [String(v)]
    })
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)

  const slots = new Map()
  const out = []
  for (const token of tokens) {
    const key = conflictKey(token)
    if (!key) {
      out.push(token)
      continue
    }
    if (slots.has(key)) out[slots.get(key)] = token
    else {
      slots.set(key, out.length)
      out.push(token)
    }
  }
  return out.join(' ')
}

function conflictKey(token) {
  const t = token.replace(/^(sm:|md:|lg:|xl:|hover:|focus:)+/, '')
  if (t === 'bg-white' || /^bg-(dust|brand|charcoal|red|season)/.test(t)) return 'bg'
  if (/^border-(dust|brand|charcoal|red|season|white)/.test(t) || t === 'border-transparent') return 'border-color'
  return null
}
