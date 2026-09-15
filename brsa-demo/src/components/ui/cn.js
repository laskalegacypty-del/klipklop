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
  const responsive = /^(sm:|md:|lg:|xl:|hover:|focus:|focus-visible:)/.test(token)
  const t = token.replace(/^(sm:|md:|lg:|xl:|hover:|focus:|focus-visible:)+/, '')
  if (t === 'bg-white' || /^bg-(dust|brand|charcoal|red|season)/.test(t)) return 'bg'
  if (/^border-(dust|brand|charcoal|red|season|white)/.test(t) || t === 'border-transparent') return 'border-color'
  if (!responsive && /^(text-white|text-charcoal|text-black|text-stone-|text-brand-|text-red-|text-season)/.test(token)) return 'text-color'
  if (!responsive && /^w-/.test(token)) return 'width'
  if (!responsive && /^h-/.test(token)) return 'height'
  return null
}
