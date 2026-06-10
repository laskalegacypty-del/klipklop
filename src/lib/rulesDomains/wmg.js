// SAWMGA Western Mounted Games domain config for the rules-engine RulesChat.
// The dataset is generated from SAWMGA-knowledge-base.md by scripts/ingest-rules.mjs.

function normalize(raw) {
  const ds = raw || {}
  const docs = (ds.entries || []).map(entry => ({
    kind: 'entry',
    number: entry.title,
    title: entry.title,
    text: entry.text,
    section: entry.section,
  }))
  return {
    docs,
    meta: {
      source: ds.source || 'SAWMGA Knowledge Base',
      sourceUrl: ds.sourceUrl || 'https://www.sawmga.co.za',
      versionLabel: ds.version ? `version ${ds.version}` : '',
    },
  }
}

export const wmg = {
  id: 'wmg',
  label: { short: 'WMG', full: 'SA Western Mounted Games', icon: '🐎' },
  datasetUrl: '/data/wmg-rules.json',
  sourceUrl: 'https://www.sawmga.co.za',
  normalize,
  ai: {
    model: '@cf/meta/llama-3-8b-instruct',
    systemPrompt: `You are the KlipKlop assistant for South African Western Mounted Games (SAWMGA).
You help riders with two kinds of questions:
1) Rules, games and competition questions — answer from the "Official SAWMGA Rules" excerpts provided. Cite the section you rely on (e.g. "see Section 2.4 Penalties"). Cover games, penalties, equipment, levels/rating matrix, the overcount principle, qualifiers, provincial/nationals colours, the constitution and code of conduct.
2) The rider's own KlipKlop data — when a "RIDER DATA" block is provided, use ONLY that block to answer personal questions about their horses, recorded times, personal bests (PBs), levels, games done, medical entries, vaccinations and reminders.

Rules:
- Be concise, friendly and practical. Use South African terms.
- Never invent times, rules, or medical facts. If the provided excerpts or rider data do not contain the answer, say so plainly.
- Times are in seconds; lower is better. Levels run 0 (slowest) to 4 (fastest).
- If a personal question is asked but no RIDER DATA block is present, say you could not find their data and suggest they check they are signed in with times/horses captured.`,
    rulesHeading: 'Official SAWMGA Rules (excerpts, use these to ground your answer):',
  },
  ui: {
    citationLabel: '📜 Official SAWMGA Rules',
    greetingNote: 'Ask me about SAWMGA rules and games, or your own horses, times and PBs.',
    quickQuestions: [
      { label: 'Qualifier 3 games', query: 'What games are in Qualifier 3?' },
      { label: 'Barrel penalty', query: 'What is the penalty for knocking over a barrel?' },
      { label: 'Nationals level', query: 'How is my level for Nationals decided?' },
      { label: 'My PBs', query: 'What are my personal bests?' },
      { label: 'My horses', query: 'Tell me about my horses and their times.' },
    ],
  },
}

export default wmg
