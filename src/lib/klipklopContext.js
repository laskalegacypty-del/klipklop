// Gathers the signed-in rider's own KlipKlop data (RLS-scoped via the supabase
// session) and renders it as a compact text block used to ground the assistant.

import { supabase } from './supabaseClient'
import { normalizeGameName } from './constants'
import { getLevel, getNationalsLevel } from './matrix'

const DATA_KEYWORDS = [
  'my ', 'pb', 'personal best', 'best time', 'my times', 'my time',
  'games done', 'games i', 'level', 'nationals', 'qualifier',
  'horse', 'horses', 'eagle', 'medical', 'vaccin', 'flu', 'ahs',
  'deworm', 'farrier', 'dental', 'coggins', 'reminder', 'due',
  'vitals', 'temperature', 'heart rate', 'passport', 'microchip',
  'how am i', 'how fast', 'fastest',
]

export function detectDataIntent(query) {
  const q = String(query || '').toLowerCase()
  return DATA_KEYWORDS.some(k => q.includes(k))
}

function fmtTime(t) {
  const n = Number(t)
  return Number.isFinite(n) ? `${n.toFixed(3)}s` : String(t)
}

function fmtDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function buildCombosBlock(profileId) {
  const { data: combos, error } = await supabase
    .from('horse_rider_combos')
    .select('*')
    .eq('user_id', profileId)
    .is('managed_rider_id', null)
    .eq('is_archived', false)
  if (error || !combos || combos.length === 0) return ''

  const lines = []
  for (const combo of combos) {
    const { data: results } = await supabase
      .from('qualifier_results')
      .select('game, time, is_nt, qualifier_events ( date )')
      .eq('combo_id', combo.id)
      .eq('is_nt', false)

    const pbMap = {}
    ;(results || []).forEach(row => {
      if (row.time == null) return
      const game = normalizeGameName(row.game)
      const time = Number(row.time)
      if (!game || Number.isNaN(time)) return
      const year = row.qualifier_events?.date
        ? new Date(row.qualifier_events.date).getFullYear()
        : null
      if (!pbMap[game] || time < pbMap[game].time) {
        pbMap[game] = { time, year }
      }
    })

    const games = Object.keys(pbMap).sort()
    const timeMap = {}
    games.forEach(g => { timeMap[g] = pbMap[g].time })
    const nationalsLevel = getNationalsLevel(timeMap)

    lines.push(`Horse/Rider combo: ${combo.horse_name || 'Unnamed'}`)
    lines.push(
      `  Nationals level: ${nationalsLevel !== null ? `L${nationalsLevel}` : 'not enough data'} (games with times: ${games.length}/13)`
    )
    if (games.length === 0) {
      lines.push('  No recorded times yet.')
    } else {
      games.forEach(g => {
        const pb = pbMap[g]
        const level = getLevel(g, pb.time)
        lines.push(
          `  - ${g}: PB ${fmtTime(pb.time)}${level !== null ? ` (L${level})` : ''}${pb.year ? `, ${pb.year}` : ''}`
        )
      })
    }
    lines.push('')
  }
  return `TIMES & PERSONAL BESTS\n${lines.join('\n')}`.trim()
}

async function buildHorsesBlock(profileId) {
  const { data: horses, error } = await supabase
    .from('horses')
    .select('*')
    .eq('user_id', profileId)
    .order('name', { ascending: true })
  if (error || !horses || horses.length === 0) return ''

  const horseIds = horses.map(h => h.id)

  const [{ data: medical }, { data: reminders }, { data: vaccinations }] = await Promise.all([
    supabase
      .from('horse_medical_entries')
      .select('horse_id, type, title, date, notes')
      .in('horse_id', horseIds)
      .order('date', { ascending: false }),
    supabase
      .from('horse_reminders')
      .select('horse_id, label, custom_label, reminder_type, next_due_date, due_date, last_done_date')
      .in('horse_id', horseIds),
    supabase
      .from('vaccination_log')
      .select('horse_id, vaccination_type, dose_number, date_administered, vet_name')
      .in('horse_id', horseIds)
      .order('date_administered', { ascending: false }),
  ])

  const byHorse = id => ({
    medical: (medical || []).filter(m => m.horse_id === id),
    reminders: (reminders || []).filter(r => r.horse_id === id),
    vaccinations: (vaccinations || []).filter(v => v.horse_id === id),
  })

  const lines = []
  for (const horse of horses) {
    const data = byHorse(horse.id)
    const age = horse.birth_year
      ? `${new Date().getFullYear() - horse.birth_year}y`
      : (horse.dob ? `${new Date().getFullYear() - new Date(horse.dob).getFullYear()}y` : '')
    lines.push(`Horse: ${horse.name}`)
    const details = [horse.breed, horse.color, horse.sex && horse.sex !== 'unknown' ? horse.sex : null, age]
      .filter(Boolean).join(', ')
    if (details) lines.push(`  ${details}`)
    if (horse.microchip_or_passport) lines.push(`  Microchip/Passport: ${horse.microchip_or_passport}`)

    if (data.medical.length) {
      lines.push('  Medical log (most recent first):')
      data.medical.slice(0, 10).forEach(m => {
        lines.push(`    - ${fmtDate(m.date)} [${m.type}] ${m.title}${m.notes ? ` — ${m.notes}` : ''}`)
      })
    }
    if (data.vaccinations.length) {
      lines.push('  Vaccinations:')
      data.vaccinations.slice(0, 8).forEach(v => {
        lines.push(`    - ${fmtDate(v.date_administered)} ${String(v.vaccination_type).toUpperCase()}${v.dose_number ? ` V${v.dose_number}` : ' (annual)'}${v.vet_name ? `, vet ${v.vet_name}` : ''}`)
      })
    }
    if (data.reminders.length) {
      lines.push('  Reminders:')
      data.reminders.forEach(r => {
        const label = r.custom_label || r.label || String(r.reminder_type || 'reminder').replace(/_/g, ' ')
        const due = r.next_due_date || r.due_date
        lines.push(`    - ${label}: next due ${fmtDate(due)}${r.last_done_date ? `, last done ${fmtDate(r.last_done_date)}` : ''}`)
      })
    }
    lines.push('')
  }
  return `HORSES, MEDICAL, VACCINATIONS & REMINDERS\n${lines.join('\n')}`.trim()
}

export async function fetchKlipklopSummary(profile) {
  if (!profile?.id) return ''
  try {
    const [combosBlock, horsesBlock] = await Promise.all([
      buildCombosBlock(profile.id).catch(() => ''),
      buildHorsesBlock(profile.id).catch(() => ''),
    ])
    const header = `Rider: ${profile.rider_name || 'Unknown'}${profile.province ? ` (${profile.province})` : ''}`
    const blocks = [header, combosBlock, horsesBlock].filter(Boolean)
    if (blocks.length <= 1) return ''
    return blocks.join('\n\n')
  } catch {
    return ''
  }
}
