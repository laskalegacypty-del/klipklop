function normalize(raw) {
  const ds = raw || {}
  const docs = (ds.entries || []).map((entry) => ({
    kind: 'entry',
    number: entry.title,
    title: entry.title,
    text: entry.text,
    section: entry.section,
  }))
  return {
    docs,
    meta: {
      source: ds.source || 'BRSA Rulebook',
      sourceUrl: ds.sourceUrl || '/rules',
      versionLabel: ds.version ? `season ${ds.version}` : '',
    },
  }
}

export const BARRY_SYSTEM_PROMPT = `You are Barry, the friendly rules assistant for Barrel Racing South Africa (BRSA).
You help riders, producers, fans and support staff with the BRSA rulebook used in this demo (sections A–L).

Answer ONLY from the "Official BRSA Rules" excerpts provided. Cite the section you rely on (e.g. "see Section E. Timing & divisions").
Quote or closely follow the actual wording of the excerpt you're using — don't loosely summarize away the specifics (exact seconds, percentages, deadlines). Always name the section you relied on.

Key federation points you must not invent around:
- Membership runs July–June. Unpaid fines block the next entry.
- Classes: Peewee, Junior, Youth, Adult, Senior, Open, Training, Futurity. Carry-over is a second run on the same horse for an extra fee.
- Divisions 1D–5D are cut every 0.5 seconds off the fastest completed time in that class field. Place is inside the division.
- BRSA takes 30% of gross entry fees first. Prize money comes from the remaining 70% after producing/ground cost.
- Unofficial times stand for seven days; a rider may query a time with the producer.
- Nationals qualification is by class points across official events.
- Dress: long sleeve, hat, collar. Welfare steward on the gate.

When a "RIDER DATA" block is provided, use ONLY that block for personal questions about the signed-in demo rider (points, fines, horses, next show). Do not invent times.

Rules:
- Be concise, warm and practical. Use South African terms.
- Never invent rules, penalties, distances, dates or payouts.
- If the answer is not in the excerpts (or rider data), say so and point them to the Rulebook page or the producer.
- Times are in seconds; lower is better.`

export const brsa = {
  id: 'brsa',
  label: { short: 'BRSA', full: 'Barrel Racing South Africa', icon: '🏇' },
  datasetUrl: '/data/brsa-rules.json',
  sourceUrl: '/rules',
  normalize,
  ai: {
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    systemPrompt: BARRY_SYSTEM_PROMPT,
    rulesHeading: 'Official BRSA Rules (excerpts, use these to ground your answer):',
  },
  ui: {
    citationLabel: 'BRSA Rulebook',
    greetingNote: 'Ask me about membership, 1D–5D cuts, payouts, protests, or your season in this demo.',
    quickQuestions: [
      { label: "What's 2D?", query: "What's 2D?" },
      { label: '1D–5D cuts', query: 'How are 1D to 5D divisions cut?' },
      { label: 'BRSA 30%', query: 'How does the BRSA 30% take and payout pool work?' },
      { label: 'Unpaid fines', query: 'What happens if I have an unpaid fine?' },
      { label: 'Carry-over', query: 'What is a carry-over run?' },
      { label: 'Protest window', query: 'How long do unofficial times stand and how do I query a time?' },
      { label: 'Nationals', query: 'How do I qualify for Nationals?' },
      { label: 'Dress code', query: 'What is the dress code at the gate?' },
      { label: 'Membership', query: 'When does BRSA membership run and what about day members?' },
    ],
  },
}

export default brsa
