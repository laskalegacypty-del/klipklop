// Gathers the signed-in rider's own KlipKlop data (RLS-scoped via the supabase
// session) and renders it as a compact text block used to ground the assistant.

import { supabase } from './supabaseClient'
import { GAMES, normalizeGameName, QUALIFIER_GAMES } from './constants'
import { getLevel, getNationalsLevel } from './matrix'
import { fetchFriendsLeaderboard, LEADERBOARD_MODES } from './friendsLeaderboard'

export const RIDER_SUMMARY_MAX_CHARS = 15000

const CURRENT_YEAR = new Date().getFullYear()

const summaryCache = new Map()

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

function countUniqueResultGames(rows) {
  return new Set(
    (rows || [])
      .filter(row => row?.game && row?.is_nt !== true)
      .map(row => normalizeGameName(row.game)),
  ).size
}

function budgetSummary(text, maxChars = RIDER_SUMMARY_MAX_CHARS) {
  const s = String(text || '').trim()
  if (s.length <= maxChars) return s
  return `${s.slice(0, maxChars - 20).trimEnd()}\n\n[summary truncated]`
}

function buildProfileBlock(profile) {
  const parts = [
    `Rider: ${profile.rider_name || 'Unknown'}`,
    profile.province ? `Province: ${profile.province}` : '',
    profile.age_category ? `Age category: ${profile.age_category}` : '',
    profile.scoresheet_name ? `Scoresheet name: ${profile.scoresheet_name}` : '',
    profile.role ? `Role: ${profile.role}` : '',
  ].filter(Boolean)
  return parts.join('\n')
}

async function fetchOwnCombos(profileId) {
  const { data, error } = await supabase
    .from('horse_rider_combos')
    .select('*')
    .eq('user_id', profileId)
    .is('managed_rider_id', null)
    .eq('is_archived', false)
    .order('is_pinned', { ascending: false })
  if (error || !data?.length) return []
  return data
}

async function buildCombosAndSeasonBlock(profile, combos) {
  if (!combos.length) return ''

  const yearStart = `${CURRENT_YEAR}-01-01`
  const yearEnd = `${CURRENT_YEAR}-12-31`

  const { data: yearEvents } = await supabase
    .from('qualifier_events')
    .select('id, province')
    .gte('date', yearStart)
    .lte('date', yearEnd)

  const yearEventIds = yearEvents?.map(e => e.id) || []
  const eventProvinceMap = {}
  yearEvents?.forEach(e => { eventProvinceMap[e.id] = e.province })

  const lines = []

  for (const combo of combos) {
    const [resultsRes, recentRes] = await Promise.all([
      yearEventIds.length > 0
        ? supabase
            .from('qualifier_results')
            .select('event_id, game, time, is_nt')
            .eq('combo_id', combo.id)
            .in('event_id', yearEventIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('qualifier_results')
        .select(`
          game, time, is_nt, level_entered, level_achieved, penalties,
          qualifier_events ( date, venue, qualifier_number, province )
        `)
        .eq('combo_id', combo.id)
        .order('qualifier_events(date)', { ascending: false })
        .limit(50),
    ])

    const yearResults = resultsRes.data || []
    const allResultsRes = await supabase
      .from('qualifier_results')
      .select('game, time, is_nt, qualifier_events ( date )')
      .eq('combo_id', combo.id)
      .eq('is_nt', false)

    const pbMap = {}
    ;(allResultsRes.data || []).forEach(row => {
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

    const uniqueEventIds = [...new Set(yearResults.map(r => r.event_id))]
    const provinceQualifiers = new Set(
      uniqueEventIds.filter(id => eventProvinceMap[id] === profile.province),
    ).size

    // Season coverage = games run (non-NT) this season — this is what Nationals
    // eligibility is measured against (need 11+ of 13).
    const seasonCoveredSet = new Set(
      yearResults
        .filter(r => r.is_nt !== true && r.game)
        .map(r => normalizeGameName(r.game)),
    )
    const gamesCovered = seasonCoveredSet.size
    const gamesNeededForNationals = GAMES.filter(g => !seasonCoveredSet.has(g))
    const gamesNoTimeEver = GAMES.filter(g => !games.includes(g))

    const metQualifiers = uniqueEventIds.length >= 2
    const metProvince = provinceQualifiers >= 2
    const metGames = gamesCovered >= 11
    const eligible = metQualifiers && metProvince && metGames

    lines.push(`Horse/Rider combo: ${combo.horse_name || 'Unnamed'}`)
    if (combo.current_level != null) {
      lines.push(`  Current level (combo): L${combo.current_level}`)
    }
    lines.push(
      `  Nationals level: ${nationalsLevel !== null ? `L${nationalsLevel}` : 'not enough data'} (games with times: ${games.length}/13)`,
    )
    lines.push(
      `  ${CURRENT_YEAR} season: ${gamesCovered}/13 games covered, ${uniqueEventIds.length} qualifiers attended, ${provinceQualifiers} in ${profile.province || 'province'} — nationals eligible: ${eligible ? 'yes' : 'no'}`,
    )
    lines.push('  Nationals requirements:')
    lines.push(`    - 11+ of 13 games covered this season: ${metGames ? 'met' : `not met (${gamesCovered}/13)`}`)
    lines.push(`    - 2+ qualifiers attended: ${metQualifiers ? 'met' : `not met (${uniqueEventIds.length})`}`)
    lines.push(`    - 2+ qualifiers in ${profile.province || 'your province'}: ${metProvince ? 'met' : `not met (${provinceQualifiers})`}`)
    if (gamesNeededForNationals.length) {
      lines.push(`  Games still needed to qualify for Nationals (run these this season): ${gamesNeededForNationals.join(', ')}`)
    } else {
      lines.push('  All 13 games covered this season.')
    }
    if (gamesNoTimeEver.length) {
      lines.push(`  Games with no recorded time ever: ${gamesNoTimeEver.join(', ')}`)
    }

    if (games.length === 0) {
      lines.push('  No recorded times yet.')
    } else {
      lines.push('  Personal bests:')
      games.forEach(g => {
        const pb = pbMap[g]
        const level = getLevel(g, pb.time)
        lines.push(
          `    - ${g}: PB ${fmtTime(pb.time)}${level !== null ? ` (L${level})` : ''}${pb.year ? `, ${pb.year}` : ''}`,
        )
      })
    }

    const recent = (recentRes.data || [])
      .filter(r => !r.is_nt && r.time != null)
      .sort((a, b) => {
        const da = a.qualifier_events?.date ? new Date(a.qualifier_events.date).getTime() : 0
        const db = b.qualifier_events?.date ? new Date(b.qualifier_events.date).getTime() : 0
        return db - da
      })
      .slice(0, 6)
    if (recent.length) {
      lines.push('  Recent runs (newest first):')
      recent.forEach(r => {
        const ev = r.qualifier_events
        const game = normalizeGameName(r.game)
        const venue = ev?.venue || ev?.province || 'Unknown venue'
        const q = ev?.qualifier_number ? `Q${ev.qualifier_number}` : ''
        const date = ev?.date ? fmtDate(ev.date) : ''
        const pen = r.penalties ? `, penalties ${r.penalties}` : ''
        const lvl = r.level_achieved != null ? `, achieved L${r.level_achieved}` : ''
        lines.push(`    - ${date} ${q} @ ${venue}: ${game} ${fmtTime(r.time)}${pen}${lvl}`)
      })
    }
    lines.push('')
  }

  return `TIMES, LEVELS & SEASON PROGRESS\n${lines.join('\n')}`.trim()
}

async function buildHorsesBlock(profileId) {
  const { data: horses, error } = await supabase
    .from('horses')
    .select('*')
    .eq('user_id', profileId)
    .order('name', { ascending: true })
  if (error) { console.error('[klipklopContext] horses query error:', error); return '' }
  if (!horses?.length) return ''

  const horseIds = horses.map(h => h.id)

  // Run each sub-query independently so one failure can't nullify the whole horse block.
  const [medicalRes, remindersRes, vaccinationsRes] = await Promise.all([
    supabase.from('horse_medical_entries').select('*').in('horse_id', horseIds).order('date', { ascending: false }).then(r => r).catch(e => ({ data: null, error: e })),
    supabase.from('horse_reminders').select('*').in('horse_id', horseIds).then(r => r).catch(e => ({ data: null, error: e })),
    supabase.from('vaccination_log').select('*').in('horse_id', horseIds).order('date_administered', { ascending: false }).then(r => r).catch(e => ({ data: null, error: e })),
  ])

  if (medicalRes.error) console.error('[klipklopContext] medical query error:', medicalRes.error)
  if (remindersRes.error) console.error('[klipklopContext] reminders query error:', remindersRes.error)
  if (vaccinationsRes.error) console.error('[klipklopContext] vaccinations query error:', vaccinationsRes.error)
  const medical = medicalRes.data || []
  const reminders = remindersRes.data || []
  const vaccinations = vaccinationsRes.data || []

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

    const vitals = data.medical.filter(m => m.type === 'vitals')
    const otherMedical = data.medical.filter(m => m.type !== 'vitals')

    if (vitals.length) {
      lines.push('  Latest vitals:')
      const latestByType = {}
      vitals.forEach(v => {
        const key = v.vital_type || v.title || 'vital'
        if (!latestByType[key]) latestByType[key] = v
      })
      Object.values(latestByType).forEach(v => {
        const val = v.vital_text_value || v.vital_value || v.notes || ''
        const abnormal = v.is_abnormal ? ` [ABNORMAL${v.abnormal_reason ? `: ${v.abnormal_reason}` : ''}]` : ''
        lines.push(`    - ${v.vital_type || v.title}: ${val}${abnormal} (${fmtDate(v.recorded_at || v.date)})`)
      })
    }

    if (otherMedical.length) {
      lines.push(`  Medical log (${otherMedical.length} entries, most recent first):`)
      otherMedical.slice(0, 20).forEach(m => {
        const flag = m.is_abnormal ? ' [ABNORMAL]' : ''
        lines.push(`    - ${fmtDate(m.date)} [${m.type}] ${m.title}${flag}${m.notes ? ` — ${m.notes}` : ''}`)
      })
      if (otherMedical.length > 20) lines.push(`    …and ${otherMedical.length - 20} older entries`)
    }

    if (data.vaccinations.length) {
      lines.push('  Vaccinations:')
      data.vaccinations.forEach(v => {
        lines.push(`    - ${fmtDate(v.date_administered)} ${String(v.vaccination_type).toUpperCase()}${v.dose_number ? ` V${v.dose_number}` : ' (annual)'}${v.vet_name ? `, vet ${v.vet_name}` : ''}`)
      })
    }

    const activeReminders = data.reminders.filter(r => !r.is_done)
    if (activeReminders.length) {
      lines.push('  Reminders:')
      activeReminders.forEach(r => {
        const label = r.custom_label || r.label || String(r.reminder_type || 'reminder').replace(/_/g, ' ')
        const due = r.next_due_date || r.due_date
        const daysUntil = due ? Math.ceil((new Date(due) - new Date()) / 86400000) : null
        const urgency = daysUntil !== null
          ? (daysUntil < 0 ? ' [OVERDUE]' : daysUntil <= 7 ? ' [DUE SOON]' : '')
          : ''
        lines.push(`    - ${label}: next due ${fmtDate(due)}${urgency}${r.last_done_date ? `, last done ${fmtDate(r.last_done_date)}` : ''}`)
      })
    }
    lines.push('')
  }
  return `HORSES, VITALS, MEDICAL & REMINDERS\n${lines.join('\n')}`.trim()
}

async function buildPersonalBestsBlock(combos) {
  if (!combos.length) return ''
  const comboIds = combos.map(c => c.id)
  const { data, error } = await supabase
    .from('personal_bests')
    .select('combo_id, game, best_time, season_year')
    .in('combo_id', comboIds)
    .order('season_year', { ascending: false })
  if (error) { console.error('[klipklopContext] personal_bests query error:', error); return '' }
  if (!data?.length) return ''

  // Group by combo → season year → game
  const byCombo = {}
  data.forEach(row => {
    const comboName = combos.find(c => c.id === row.combo_id)?.horse_name || row.combo_id
    if (!byCombo[comboName]) byCombo[comboName] = {}
    if (!byCombo[comboName][row.season_year]) byCombo[comboName][row.season_year] = []
    byCombo[comboName][row.season_year].push({ game: normalizeGameName(row.game), time: row.best_time })
  })

  const lines = []
  for (const [comboName, years] of Object.entries(byCombo)) {
    lines.push(`Combo: ${comboName}`)
    for (const year of Object.keys(years).sort((a, b) => b - a)) {
      const entries = years[year].sort((a, b) => (a.game || '').localeCompare(b.game || ''))
      lines.push(`  ${year} season PBs:`)
      entries.forEach(e => {
        const level = getLevel(e.game, e.time)
        lines.push(`    - ${e.game}: ${fmtTime(e.time)}${level !== null ? ` (L${level})` : ''}`)
      })
    }
    lines.push('')
  }
  return `PERSONAL BESTS BY SEASON\n${lines.join('\n')}`.trim()
}

async function buildVideosBlock(profileId) {
  const { data, error } = await supabase
    .from('horse_videos')
    .select('title, created_at, qualifier_id, horses ( name )')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(6)
  if (error || !data?.length) return ''

  const lines = data.map(v => {
    const horse = v.horses?.name || 'Unknown horse'
    const q = v.qualifier_id ? ` (qualifier event ${v.qualifier_id})` : ''
    return `- ${horse}: "${v.title || 'Untitled'}"${q}, ${fmtDate(v.created_at)}`
  })
  return `HORSE VIDEOS (${data.length} recent)\n${lines.join('\n')}`
}

async function buildEventsBlock(profile) {
  const today = new Date().toISOString().slice(0, 10)
  const province = profile?.province

  const [{ data: upcoming }, { data: recent }] = await Promise.all([
    supabase
      .from('qualifier_events')
      .select('date, province, venue, qualifier_number, event_type, notes')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(8),
    supabase
      .from('qualifier_events')
      .select('date, province, venue, qualifier_number, event_type')
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(4),
  ])

  const lines = []
  if (upcoming?.length) {
    lines.push('Upcoming events:')
    upcoming.forEach(e => {
      const games = e.qualifier_number ? (QUALIFIER_GAMES[e.qualifier_number] || []).join(', ') : ''
      const inProvince = province && e.province === province ? ' [your province]' : ''
      lines.push(
        `  - ${fmtDate(e.date)} ${e.event_type || 'event'}${e.qualifier_number ? ` Q${e.qualifier_number}` : ''} @ ${e.venue || e.province}${inProvince}${games ? ` — games: ${games}` : ''}`,
      )
    })
  }
  if (recent?.length) {
    lines.push('Recent past events:')
    recent.forEach(e => {
      lines.push(
        `  - ${fmtDate(e.date)} ${e.event_type || 'event'}${e.qualifier_number ? ` Q${e.qualifier_number}` : ''} @ ${e.venue || e.province}`,
      )
    })
  }
  if (!lines.length) return ''
  return `QUALIFIER EVENTS\n${lines.join('\n')}`
}

async function buildLeaderboardBlock(profile, combos) {
  if (!combos.length) return ''
  const myComboId = combos.find(c => c.is_pinned)?.id || combos[0]?.id
  try {
    const rows = await fetchFriendsLeaderboard({
      mode: LEADERBOARD_MODES.CURRENT_YEAR,
      year: CURRENT_YEAR,
      game: 'all',
      myComboId,
    })
    const myRow = rows.find(r => r.user_id === profile.id)
    if (!myRow) return 'FRIENDS LEADERBOARD\nNo friends leaderboard entry yet (add friends to compare).'
    return [
      'FRIENDS LEADERBOARD',
      `Rank: #${myRow.rank} of ${rows.length}`,
      `Games covered: ${myRow.games_covered || 0}/13`,
      `Level points: ${myRow.level_points ?? 'n/a'}`,
      `Placings: ${myRow.placings ?? 'n/a'}`,
    ].join('\n')
  } catch {
    return ''
  }
}

async function buildNotificationsBlock(profileId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('type, message, created_at, is_read')
    .eq('user_id', profileId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(8)
  if (error || !data?.length) return ''

  const lines = data.map(n => `- [${n.type}] ${n.message} (${fmtDate(n.created_at)})`)
  return `UNREAD NOTIFICATIONS\n${lines.join('\n')}`
}

async function buildAnnouncementsBlock() {
  const { data, error } = await supabase
    .from('announcements')
    .select('title, body, is_pinned, expires_at, created_at')
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5)
  if (error || !data?.length) return ''

  const lines = data.map(a => {
    const pin = a.is_pinned ? '[PINNED] ' : ''
    const body = String(a.body || '').slice(0, 120)
    return `- ${pin}${a.title}: ${body}${body.length >= 120 ? '…' : ''}`
  })
  return `ANNOUNCEMENTS\n${lines.join('\n')}`
}

export async function fetchKlipklopSummary(profile) {
  if (!profile?.id) {
    console.warn('[klipklopContext] fetchKlipklopSummary called with no profile id')
    return ''
  }
  console.log('[klipklopContext] fetching summary for profile:', profile.id)
  try {
    const combos = await fetchOwnCombos(profile.id)
    console.log('[klipklopContext] combos:', combos.length)

    const [
      combosBlock,
      personalBestsBlock,
      horsesBlock,
      videosBlock,
      eventsBlock,
      leaderboardBlock,
      notificationsBlock,
      announcementsBlock,
    ] = await Promise.all([
      buildCombosAndSeasonBlock(profile, combos).catch(e => { console.error('[klipklopContext] combosBlock error:', e); return '' }),
      buildPersonalBestsBlock(combos).catch(e => { console.error('[klipklopContext] personalBestsBlock error:', e); return '' }),
      buildHorsesBlock(profile.id).catch(e => { console.error('[klipklopContext] horsesBlock error:', e); return '' }),
      buildVideosBlock(profile.id).catch(e => { console.error('[klipklopContext] videosBlock error:', e); return '' }),
      buildEventsBlock(profile).catch(e => { console.error('[klipklopContext] eventsBlock error:', e); return '' }),
      buildLeaderboardBlock(profile, combos).catch(e => { console.error('[klipklopContext] leaderboardBlock error:', e); return '' }),
      buildNotificationsBlock(profile.id).catch(e => { console.error('[klipklopContext] notificationsBlock error:', e); return '' }),
      buildAnnouncementsBlock().catch(e => { console.error('[klipklopContext] announcementsBlock error:', e); return '' }),
    ])

    console.log('[klipklopContext] blocks built — combos:', combosBlock.length, 'pbs:', personalBestsBlock.length, 'horses:', horsesBlock.length, 'events:', eventsBlock.length)

    const profileBlock = buildProfileBlock(profile)
    const blocks = [
      profileBlock,
      combosBlock,
      personalBestsBlock,
      horsesBlock,
      videosBlock,
      eventsBlock,
      leaderboardBlock,
      notificationsBlock,
      announcementsBlock,
    ].filter(Boolean)

    if (blocks.length <= 1) {
      console.warn('[klipklopContext] only profileBlock built — all other blocks empty. blocks:', blocks)
      // Return the profile block anyway so the AI at least knows who the rider is
      return budgetSummary(profileBlock)
    }
    const summary = budgetSummary(blocks.join('\n\n'))
    console.log('[klipklopContext] summary built, length:', summary.length)
    return summary
  } catch (err) {
    console.error('[klipklopContext] fetchKlipklopSummary outer error:', err)
    return ''
  }
}

/** Session-scoped cache — fetched once per rider per page load. */
export async function getCachedKlipklopSummary(profile) {
  if (!profile?.id) return ''
  const hit = summaryCache.get(profile.id)
  if (typeof hit === 'string') return hit
  if (hit instanceof Promise) return hit

  const promise = fetchKlipklopSummary(profile)
    .then(text => {
      summaryCache.set(profile.id, text)
      return text
    })
    .catch(() => {
      summaryCache.delete(profile.id)
      return ''
    })

  summaryCache.set(profile.id, promise)
  return promise
}

export function clearKlipklopSummaryCache(profileId) {
  if (profileId) summaryCache.delete(profileId)
  else summaryCache.clear()
}
