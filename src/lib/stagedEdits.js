const TABLE_LABELS = {
  profiles: 'Profile details',
  horses: 'Horses',
  horse_rider_combos: 'Horse/rider combos',
  qualifier_results: 'Qualifier results',
  event_day_results: 'Event day results',
  personal_bests: 'Personal bests',
  horse_reminders: 'Reminders',
  horse_medical_entries: 'Medical entries',
  vaccination_log: 'Vaccination log entries',
  qualifier_events: null, // internal plumbing (auto-created historical events) — not shown
}

const OPERATION_VERB = {
  insert: 'added',
  upsert: 'added/updated',
  update: 'updated',
  delete: 'removed',
}

// Turns a flat list of staged_edit_items rows into a short, grouped,
// human-readable summary — e.g. "Profile details updated · 2 horses added ·
// 3 qualifier results added". Deliberately not a per-field diff.
export function summarizeStagedItems(items) {
  if (!items || items.length === 0) return []

  const byTable = {}
  for (const item of items) {
    const label = TABLE_LABELS[item.table_name]
    if (label === null) continue // skip internal-plumbing tables
    const key = TABLE_LABELS[item.table_name] || item.table_name
    if (!byTable[key]) byTable[key] = {}
    byTable[key][item.operation] = (byTable[key][item.operation] || 0) + 1
  }

  const lines = []
  for (const [label, ops] of Object.entries(byTable)) {
    if (label === 'Profile details') {
      lines.push('Profile details updated')
      continue
    }
    const parts = Object.entries(ops).map(([op, count]) => `${count} ${OPERATION_VERB[op] || op}`)
    lines.push(`${label}: ${parts.join(', ')}`)
  }
  return lines
}
