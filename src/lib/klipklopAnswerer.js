// Builds a rules-engine answerer that calls our Cloudflare Workers AI proxy and,
// for personal questions, grounds the model with the rider's own KlipKlop data.
//
// Returns '' on any failure so RulesChat falls back to offline retrieval.

import { detectDataIntent, fetchKlipklopSummary } from './klipklopContext'

const ENDPOINT = '/api/rules/chat'

export function createKlipklopAnswerer(profile) {
  return async function klipklopAnswerer({ query, domain, context }) {
    let riderData = ''
    if (detectDataIntent(query)) {
      try {
        riderData = await fetchKlipklopSummary(profile)
      } catch {
        riderData = ''
      }
    }

    const merged = [
      context ? `${domain?.ai?.rulesHeading || 'Official rules:'}\n${context}` : '',
      riderData ? `RIDER DATA (the signed-in rider's own KlipKlop records):\n${riderData}` : '',
    ].filter(Boolean).join('\n\n')

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          context: merged,
          systemPrompt: domain?.ai?.systemPrompt,
          model: domain?.ai?.model,
        }),
      })
      if (!res.ok) return ''
      const data = await res.json().catch(() => ({}))
      if (data.fallback || !data.response) return ''
      return String(data.response)
    } catch {
      return ''
    }
  }
}

export default createKlipklopAnswerer
