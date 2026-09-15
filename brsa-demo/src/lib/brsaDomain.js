function normalize(raw) {
  const ds = raw || {}
  const docs = []
  for (const section of ds.sections || []) {
    for (const entry of section.entries || []) {
      docs.push({
        kind: 'entry',
        number: entry.label || entry.number,
        title: entry.label || `Rule ${entry.number}`,
        text: entry.text,
        section: section.heading || section.title,
      })
    }
  }
  return {
    docs,
    meta: {
      source: ds.source || 'BRSA Rule Book (2026 Revision)',
      sourceUrl: ds.sourceUrl || '/rules',
      versionLabel: '2026 Revision',
    },
  }
}

export const BARRY_SYSTEM_PROMPT = `You are Barry, the friendly rules assistant for Barrel Racing South Africa (BRSA).
You help riders, producers, fans and support staff with the official BRSA Rule Book (2026 Revision), sections A–L.

Answer ONLY from the "Official BRSA Rules" excerpts provided. Quote the excerpt's own wording closely — do not paraphrase away fees, percentages, distances, deadlines or splits.
Always cite the exact excerpt, e.g. "(Section E, Rule 3)".
**Bold** the important specifics (fees, percentages, deadlines, citations) in every answer.

BRSA practice notes in the excerpts (marked as such) are additive current-practice comments from the federation. Prefer them when they conflict with older formal wording in the same excerpt.

When a "RIDER DATA" block is provided, use ONLY that block for personal questions about the signed-in demo rider. Do not invent times.

Rules:
- Be concise, warm and practical. Use South African terms.
- The federation title is Championships (not Nationals), unless the excerpt itself uses another word.
- Never invent rules, penalties, distances, dates or payouts.
- If the answer is not in the excerpts (or rider data), say so and point them to the Rulebook page or the producer.
- Times are in seconds; lower is better.`

export const brsa = {
  id: 'brsa',
  label: { short: 'BRSA', full: 'Barrel Racing South Africa', icon: '🏇' },
  datasetUrl: '/data/brsa-rulebook.json',
  sourceUrl: '/rules',
  normalize,
  ai: {
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    systemPrompt: BARRY_SYSTEM_PROMPT,
    rulesHeading: 'Official BRSA Rules (excerpts, use these to ground your answer):',
  },
  ui: {
    citationLabel: 'BRSA Rule Book',
    greetingNote: 'Ask me about membership, 3D payouts, protests, or Championships — I’ll cite the 2026 rulebook.',
    quickQuestions: [
      { label: "What's 2D?", query: "What's 2D?" },
      { label: 'How are divisions split?', query: 'How are divisions determined and what is the split?' },
      { label: 'BRSA payout', query: 'How does the BRSA payout work — R150 and the 30/70 split?' },
      { label: 'Unpaid fines', query: 'What happens if I have an unpaid fine?' },
      { label: 'Carry-over', query: 'What is a carry-over run?' },
      { label: 'Protest window', query: 'How long do unofficial times stand and how do I query a time?' },
      { label: 'Championships', query: 'How do I qualify for Championships?' },
      { label: 'Dress code', query: 'What is the dress code at the gate?' },
      { label: 'Membership', query: 'When does BRSA membership run and what about day members?' },
    ],
  },
}

export default brsa
