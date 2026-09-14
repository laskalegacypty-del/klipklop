const DATASET_URL = '/data/brsa-rules.json'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'from', 'they',
  'this', 'that', 'with', 'will', 'what', 'how', 'when', 'who', 'why', 'does',
  'did', 'about', 'into', 'than', 'then', 'them', 'these', 'those', 'which',
  'would', 'could', 'should', 'there', 'their', 'your', 'just', 'also', 'only',
  'very', 'more', 'some', 'such', 'each', 'other', 'over', 'after', 'before',
  'because', 'while', 'where', 'here', 'being', 'please', 'explain', 'tell',
  'help',
])

export function tokenize(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
}

function termFreq(tokens) {
  const tf = new Map()
  for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1)
  return tf
}

export function indexEntries(entries = []) {
  return (entries || []).map((entry) => {
    const text = [entry.section, entry.title, entry.text].filter(Boolean).join(' ')
    const tokens = tokenize(text)
    return {
      title: entry.title || '',
      section: entry.section || entry.title || '',
      text: entry.text || '',
      tokens,
      tf: termFreq(tokens),
    }
  })
}

export function searchIndexed(docs, query, limit = 6) {
  const queryTokens = tokenize(query)
  if (!queryTokens.length || !docs?.length) return []

  const scored = docs.map((doc) => {
    let score = 0
    for (const token of queryTokens) score += doc.tf.get(token) || 0
    return { doc, score }
  }).filter((row) => row.score > 0)

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((row) => ({
    title: row.doc.title,
    section: row.doc.section,
    text: row.doc.text,
    score: row.score,
  }))
}

export function buildBarryContext(matches, charBudget = 6000) {
  if (!matches?.length) return ''
  const parts = []
  let used = 0
  for (const match of matches) {
    const block = `${match.section}\n${match.text}`
    if (used && used + block.length + 2 > charBudget) break
    parts.push(block)
    used += block.length + 2
  }
  return parts.join('\n\n')
}

let cache = null

export async function loadBarryRules() {
  if (cache) return cache
  const res = await fetch(DATASET_URL)
  if (!res.ok) throw new Error(`Could not load ${DATASET_URL}`)
  const data = await res.json()
  cache = indexEntries(data.entries)
  return cache
}

export function searchBarryRules(query, limit = 6) {
  return searchIndexed(cache || [], query, limit)
}
