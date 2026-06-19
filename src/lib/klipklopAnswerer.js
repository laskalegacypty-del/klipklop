// Builds a rules-engine answerer that calls our Cloudflare Workers AI proxy and
// grounds the model with the rider's own KlipKlop data (always included when available).
// Falls back to direct data extraction when the AI proxy is unavailable.

import { getCachedKlipklopSummary } from './klipklopContext'

const ENDPOINT = '/api/rules/chat'

// Extract the most relevant section(s) from the rider summary for a given query.
function extractRiderDataFallback(riderData, query) {
  const q = query.toLowerCase()
  const sections = riderData.split(/\n(?=[A-Z][A-Z\s&,]+\n)/)

  // Map query keywords → section heading fragments
  const sectionMap = [
    { keys: ['horse', 'breed', 'color', 'vital', 'medical', 'vaccin', 'reminder', 'vet'], heading: 'HORSES' },
    { keys: ['pb', 'personal best', 'time', 'level', 'season', 'qualifier', 'national', 'eligible', 'game'], heading: 'TIMES' },
    { keys: ['event', 'next', 'upcoming', 'when', 'calendar', 'schedule'], heading: 'QUALIFIER EVENTS' },
    { keys: ['rank', 'leaderboard', 'friend', 'standing'], heading: 'FRIENDS LEADERBOARD' },
    { keys: ['announcement', 'news', 'notice'], heading: 'ANNOUNCEMENTS' },
    { keys: ['notification', 'unread', 'alert'], heading: 'UNREAD NOTIFICATIONS' },
  ]

  const matched = []
  for (const { keys, heading } of sectionMap) {
    if (keys.some(k => q.includes(k))) {
      const sec = sections.find(s => s.toUpperCase().includes(heading))
      if (sec) matched.push(sec.trim())
    }
  }

  if (!matched.length) {
    // Return first ~1500 chars as a general overview
    return riderData.slice(0, 1500).trimEnd() + (riderData.length > 1500 ? '\n\n…(more data available)' : '')
  }
  return matched.slice(0, 2).join('\n\n')
}

export function createKlipklopAnswerer(profile) {
  return async function klipklopAnswerer({ query, domain, context, history }) {
    let riderData = ''
    try {
      riderData = await getCachedKlipklopSummary(profile)
    } catch (err) {
      console.error('[klipklopAnswerer] summary fetch failed:', err)
      riderData = ''
    }

    if (!riderData) {
      console.warn('[klipklopAnswerer] rider data is empty — profile id:', profile?.id)
    } else {
      console.log('[klipklopAnswerer] rider data length:', riderData.length)
    }

    const merged = [
      context ? `${domain?.ai?.rulesHeading || 'Official rules:'}\n${context}` : '',
      riderData ? `RIDER DATA (the signed-in rider's own KlipKlop records):\n${riderData}` : '',
    ].filter(Boolean).join('\n\n')

    // Try the AI proxy first
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          context: merged,
          systemPrompt: domain?.ai?.systemPrompt,
          model: domain?.ai?.model,
          history: Array.isArray(history) ? history : [],
        }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (!data.fallback && data.response) {
          return String(data.response)
        }
        console.warn('[klipklopAnswerer] AI proxy fallback flag or empty response:', data)
      } else {
        console.warn('[klipklopAnswerer] AI proxy HTTP error:', res.status)
      }
    } catch (err) {
      console.warn('[klipklopAnswerer] AI proxy unreachable (is the API server running?):', err?.message)
    }

    // AI proxy unavailable — fall back to direct data extraction
    if (riderData) {
      const section = extractRiderDataFallback(riderData, query)
      return `Here's what I found in your KlipKlop data:\n\n${section}\n\n*(AI assistant offline — showing raw data. Run \`npm run dev:layer2\` and add your \`CF_API_TOKEN\` to .env for full AI responses.)*`
    }

    return ''
  }
}

export default createKlipklopAnswerer
