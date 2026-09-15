const DATASET_URL = '/data/brsa-rulebook.json'

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

const ALIASES = {
  '1d': ['1st', 'first'],
  '2d': ['2nd', 'second'],
  '3d': ['3rd', 'third'],
  '4d': ['4th', 'fourth'],
  '5d': ['5th', 'fifth'],
  nationals: ['championships', 'championship'],
  championships: ['nationals', 'championship'],
}

export function tokenize(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
}

function expandToken(token) {
  const out = new Set([token])
  for (const alias of ALIASES[token] || []) out.add(alias)
  if (token.endsWith('s') && token.length > 4) out.add(token.slice(0, -1))
  else if (token.length > 3 && !token.endsWith('s')) out.add(`${token}s`)
  return [...out]
}

function expandQuery(tokens) {
  const out = new Set()
  for (const token of tokens) expandToken(token).forEach((t) => out.add(t))
  return [...out]
}

function termFreq(tokens) {
  const tf = new Map()
  for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1)
  return tf
}

export function flattenRulebook(data = {}) {
  const sections = data.sections || []
  const entries = []
  for (const section of sections) {
    const heading = section.heading || section.title || `Section ${section.id}`
    for (const entry of section.entries || []) {
      entries.push({
        id: entry.id,
        sectionId: section.id,
        section: heading,
        sectionTitle: section.title || heading,
        title: entry.label || `Rule ${entry.number}`,
        number: entry.number,
        text: entry.text || '',
        note: entry.note || '',
      })
    }
  }
  return { source: data.source || 'BRSA Rule Book', sourceUrl: data.sourceUrl || '/rules', sections, entries }
}

export function indexEntries(entries = [], sections = []) {
  return (entries || []).map((entry) => {
    const text = [entry.section, entry.title, entry.text, entry.note].filter(Boolean).join(' ')
    const tokens = tokenize(text)
    return {
      ...entry,
      tokens,
      tf: termFreq(tokens),
      sectionEntries: (sections.find((s) => s.id === entry.sectionId)?.entries || []).map((e) => ({
        id: e.id,
        title: e.label || `Rule ${e.number}`,
        number: e.number,
        text: e.text || '',
        note: e.note || '',
      })),
    }
  })
}

function docMatchesToken(doc, token) {
  return expandToken(token).some((variant) => doc.tf.has(variant))
}

export function searchIndexed(docs, query, limit = 6) {
  const core = tokenize(query)
  if (!core.length || !docs?.length) return []

  const scored = docs.map((doc) => {
    let matched = 0
    for (const token of core) {
      if (docMatchesToken(doc, token)) matched += 1
    }
    if (!matched) return { doc, score: 0 }
    let score = matched
    if (matched === core.length) score += 2
    score += Math.min(0.8, 24 / Math.max(doc.tokens.length, 8))
    return { doc, score }
  }).filter((row) => row.score > 0)

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((row) => ({
    id: row.doc.id,
    title: row.doc.title,
    section: row.doc.section,
    sectionId: row.doc.sectionId,
    number: row.doc.number,
    text: row.doc.text,
    note: row.doc.note,
    sectionEntries: row.doc.sectionEntries,
    score: row.score,
  }))
}

export function buildBarryContext(matches, charBudget = 8000) {
  if (!matches?.length) return ''
  const parts = []
  let used = 0
  for (const match of matches) {
    const cite = match.sectionId ? `(Section ${match.sectionId}, ${match.title})` : match.section
    const note = match.note ? `\n[BRSA practice note: ${match.note}]` : ''
    const block = `${cite}\n${match.text}${note}`
    if (used && used + block.length + 2 > charBudget) break
    parts.push(block)
    used += block.length + 2
  }
  return parts.join('\n\n')
}

let cache = null
let meta = { source: 'BRSA Rule Book', sections: [] }

export async function loadBarryRules() {
  if (cache) return cache
  const res = await fetch(DATASET_URL)
  if (!res.ok) throw new Error(`Could not load ${DATASET_URL}`)
  const data = await res.json()
  const flat = flattenRulebook(data)
  meta = { source: flat.source, sourceUrl: flat.sourceUrl, sections: flat.sections }
  cache = indexEntries(flat.entries, flat.sections)
  return cache
}

export function getRulebookMeta() {
  return meta
}

export function searchBarryRules(query, limit = 6) {
  return searchIndexed(cache || [], query, limit)
}

export { expandQuery }
