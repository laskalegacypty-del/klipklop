const GAMES = [
  'Barrels', 'Flags', 'Poles', 'Sacks', 'Mugs', 'Flask', 'Sword', 'Keyhole',
  'Hankies', 'Bending', 'Quart', 'Carton', 'Ribbon',
]

function normalizeGameName(game) {
  if (!game) return ''
  const trimmed = String(game).trim()
  const match = GAMES.find(g => g.toLowerCase() === trimmed.toLowerCase())
  return match || trimmed
}

function buildCarryForwardPbMap(rows) {
  const map = {}
  rows?.forEach(row => {
    const game = normalizeGameName(row.game)
    if (!game) return
    const current = map[game]
    if (!current || row.best_time < current.best_time) {
      map[game] = { ...row, game }
    }
  })
  return map
}

export async function fetchShareTimesPayload(admin, comboId, selectedYear) {
  const year = Number(selectedYear) || new Date().getFullYear()

  const { data: combo, error: comboError } = await admin
    .from('horse_rider_combos')
    .select('id, horse_name, horse_id, user_id')
    .eq('id', comboId)
    .maybeSingle()

  if (comboError || !combo) {
    throw new Error('Combo not found')
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('rider_name')
    .eq('id', combo.user_id)
    .maybeSingle()

  const riderName = profile?.rider_name
    ? String(profile.rider_name).split(/\s+/)[0]
    : 'Rider'

  const { data: yearEvents } = await admin
    .from('qualifier_events')
    .select('id')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)

  const yearEventIds = yearEvents?.map(e => e.id) || []

  const [pbRes, resultsRes] = await Promise.all([
    admin
      .from('personal_bests')
      .select('*')
      .eq('combo_id', comboId)
      .lte('season_year', year),
    yearEventIds.length > 0
      ? admin
        .from('qualifier_results')
        .select(`
          id,
          event_id,
          game,
          time,
          is_nt,
          created_at,
          qualifier_events (
            date,
            venue,
            province,
            qualifier_number,
            event_type
          )
        `)
        .eq('combo_id', comboId)
        .in('event_id', yearEventIds)
        .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const personalBests = buildCarryForwardPbMap(pbRes.data)
  const yearBests = {}
  const trendRows = []

  resultsRes.data?.forEach(row => {
    const game = normalizeGameName(row.game)
    if (!row.is_nt && row.time != null && game) {
      const bestTime = Number.parseFloat(String(row.time).replace(',', '.'))
      if (!Number.isNaN(bestTime)) {
        const current = yearBests[game]
        if (!current || bestTime < current.best_time) {
          yearBests[game] = { game, best_time: bestTime, season_year: year }
        }
        trendRows.push({
          game,
          time: bestTime,
          date: row.qualifier_events?.date || null,
        })
      }
    }
  })

  const grouped = {}
  resultsRes.data?.forEach(result => {
    const eventId = result.event_id
    if (!grouped[eventId]) {
      grouped[eventId] = { event: result.qualifier_events, results: [] }
    }
    grouped[eventId].results.push({
      id: result.id,
      event_id: result.event_id,
      game: normalizeGameName(result.game),
      time: result.time,
      is_nt: result.is_nt,
    })
  })

  const history = Object.values(grouped)

  return {
    selected_year: year,
    combo: {
      id: combo.id,
      horse_name: combo.horse_name,
    },
    rider_name: riderName,
    personal_bests: personalBests,
    year_bests: yearBests,
    history,
    trend_rows: trendRows,
  }
}

export function buildShareMeta({ horseName, riderName, selectedYear, origin, token }) {
  const url = `${String(origin).replace(/\/$/, '')}/share/${token}`
  const horse = horseName || 'Horse'
  return {
    horse_name: horse,
    rider_name: riderName || 'Rider',
    season_year: selectedYear,
    share_title: `${horse}'s times — KlipKlop`,
    share_message: `Check out ${horse}'s Western Mounted Games times on KlipKlop:\n${url}`,
    share_url: url,
  }
}
