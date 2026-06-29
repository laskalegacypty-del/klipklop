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
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    systemPrompt: `You are the KlipKlop assistant for South African Western Mounted Games (SAWMGA).
You help riders with two kinds of questions:
1) Rules, games and competition questions — answer from the "Official SAWMGA Rules" excerpts provided. Cite the section you rely on (e.g. "see Section 2.4 Penalties"). Cover games, penalties, equipment, levels/rating matrix, the overcount principle, qualifiers, provincial/nationals colours, the constitution and code of conduct.
2) The rider's own KlipKlop data — when a "RIDER DATA" block is provided, use ONLY that block for personal questions. It may include sections such as: profile, times/levels/season progress, personal bests, recent runs, horses, vitals, medical log, vaccinations, reminders, horse videos, upcoming qualifier events, friends leaderboard rank, notifications, and announcements.

LEVEL PREDICTION — SAWMGA OVERCOUNT PRINCIPLE:
KlipKlop uses the official SAWMGA overcount rule (not a simple game-count rule) to predict the level a rider will compete at Nationals. It works like this, applied to each qualifier the rider attended in date order:
1. Per-game overcount (OC) = max(0, level_achieved - level_entered) for each game at that qualifier.
2. Bonus OC = number of games at that qualifier where the per-game OC was 3 or more.
3. Effective OC = sum of all per-game OCs + bonus OC.
4. Level jump = floor(effectiveOC / 4).
5. New level = min(4, level_entered + level_jump).
6. The new level becomes the entering level for the NEXT qualifier.
The RIDER DATA block shows the "Predicted nationals level (overcount)" which is the result of chaining this rule through all qualifiers attended so far. When riders ask "what level will I compete at Nationals?" or "how is my level determined?", explain this rule and refer to the value in their RIDER DATA.

Rules:
- Be concise, friendly and practical. Use South African terms.
- Never invent times, rules, penalties, distances, dates, or medical facts.
- If the answer is not in the provided rules excerpts, say you do not have that rule and suggest checking the official SAWMGA rulebook at sawmga.co.za.
- For personal questions, use only the RIDER DATA block. If the data is missing or empty for that topic, say so and suggest where in KlipKlop to check (e.g. My Times, Horses, Season Overview).
- Times are in seconds; lower is better. Levels run 0 (slowest) to 4 (fastest).
- Nationals eligibility typically requires 2+ qualifiers, 2+ in the rider's province, and 11+ of 13 games covered — use the season progress lines in RIDER DATA when present.`,
    rulesHeading: 'Official SAWMGA Rules (excerpts, use these to ground your answer):',
  },
  ui: {
    citationLabel: '📜 Official SAWMGA Rules',
    greetingNote: 'Ask me about SAWMGA rules and games, or your own horses, times, vitals, reminders and PBs.',
    quickQuestions: [
      { label: 'My PBs', query: 'What are my personal bests for each game?' },
      { label: 'Am I eligible?', query: 'Am I eligible for Nationals this season?' },
      { label: 'Next event', query: 'When is my next qualifier event?' },
      { label: 'My horses', query: 'Tell me about my horses.' },
      { label: 'Reminders', query: 'Do I have any overdue or upcoming reminders for my horses?' },
      { label: 'Vaccinations', query: 'Are my horses vaccinations up to date for Nationals?' },
      { label: 'Horse vitals', query: 'What are the latest vitals for my horses? Anything abnormal?' },
      { label: 'My season', query: 'How is my season going? What games do I still need to run?' },
      { label: 'Barrel penalty', query: 'What is the penalty for knocking over a barrel?' },
      { label: 'Qualifier 3 games', query: 'What games are in Qualifier 3?' },
      { label: 'Nationals level', query: 'How is my level for Nationals decided?' },
      { label: 'Flag Race rules', query: 'Explain the rules for the Flag Race game.' },
    ],
  },
}

export default wmg
