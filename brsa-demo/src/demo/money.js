export const CLASS_FEES = {
  Training: 250,
  Peewee: 250,
  Junior: 300,
  Youth: 350,
  Adult: 350,
  Senior: 350,
  Open: 450,
  Futurity: 350,
}

export const CARRY_OVER_FEE = 300
export const PRODUCING_COST = 150

export const MEMBERSHIP_FEES = {
  Peewee: 300,
  Junior: 350,
  Youth: 400,
  Adult: 600,
  Senior: 600,
  'Futurity horse': 350,
}

export const HOF_CATEGORIES = [
  { id: 'brsa-record', label: 'BRSA Record' },
  { id: 'sa-record', label: 'South African Record' },
  { id: 'championship', label: 'Championship Win' },
  { id: 'special', label: 'Special Recognition' },
]

export const AWARD_CATEGORIES = ['Best Run', 'Video Post', 'Best Venue', 'Cowboy/Cowgirl of the Month']

export function rand(n) {
  return `R${Number(n).toLocaleString('en-ZA')}`
}

export function entryFee(klass, carryOver) {
  return (CLASS_FEES[klass] ?? 350) + (carryOver ? CARRY_OVER_FEE : 0)
}

export function membershipFee(klass) {
  return MEMBERSHIP_FEES[klass] ?? MEMBERSHIP_FEES.Adult
}

export function placePoints(place) {
  if (place >= 1 && place <= 5) return 6 - place
  return 0
}

/** Participation + placing. No carry-over bonus. */
export function pointsForResult(result) {
  if (result?.scratch || result?.time == null) return 0
  return 5 + placePoints(result.place)
}

/**
 * BRSA 30% of gross entry fees first.
 * Remaining 70% (payout pool) minus producing costs = prize pool.
 */
export function splitFees(gross, producing) {
  const brsaAdmin = Math.round(gross * 0.3)
  const payoutPool = Math.max(0, gross - brsaAdmin)
  const prizePool = Math.max(0, payoutPool - producing)
  return { gross, producing, brsaAdmin, payoutPool, prizePool, groundLevy: producing }
}

export function estimatePayout(paidEntries, producingCost = PRODUCING_COST) {
  const gross = paidEntries.reduce((s, e) => s + (e.fee ?? 0), 0)
  const producing = paidEntries.length * producingCost
  return splitFees(gross, producing)
}

export function bestTime(row) {
  const times = [row.run1, row.run2, row.time].filter((t) => typeof t === 'number' && !Number.isNaN(t))
  if (!times.length) return null
  return Math.min(...times)
}

/** Rulebook E.3 — 0.5s buckets off the fastest completed time. */
export function computeDivisionsAndPlaces(rows) {
  const completed = rows
    .map((r) => ({ ...r, officialTime: bestTime(r) }))
    .filter((r) => r.officialTime != null && !r.scratch)
  if (!completed.length) {
    return rows.map((r) => ({ ...r, division: r.division ?? null, place: r.place ?? null, officialTime: bestTime(r) }))
  }
  const fastest = Math.min(...completed.map((r) => r.officialTime))
  const divisions = ['1D', '2D', '3D', '4D', '5D']
  const byDiv = { '1D': [], '2D': [], '3D': [], '4D': [], '5D': [] }
  for (const row of completed) {
    const steps = Math.min(4, Math.floor((row.officialTime - fastest + 1e-9) / 0.5))
    row.division = divisions[steps]
    byDiv[row.division].push(row)
  }
  for (const div of divisions) {
    byDiv[div].sort((a, b) => a.officialTime - b.officialTime)
    byDiv[div].forEach((row, i) => {
      row.place = i + 1
      row.time = row.officialTime
    })
  }
  const byId = Object.fromEntries(completed.map((r) => [r.id, r]))
  return rows.map((r) => {
    const done = byId[r.id]
    if (!done) return { ...r, officialTime: bestTime(r), division: r.scratch ? null : r.division, place: r.scratch ? null : r.place }
    return done
  })
}

export function parseTimesheet(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const parsed = []
  for (const line of lines) {
    const cells = line.split(/[,;\t|]+/).map((c) => c.trim())
    if (!cells.length) continue
    if (/^(horse|rider|name|draw)/i.test(cells[0])) continue
    const timeToken = cells.find((c) => /^\d+[.,]\d{1,3}$/.test(c) || /^\d+:\d{2}[.,]\d+$/.test(c))
    const time = timeToken ? Number(String(timeToken).replace(':', '').replace(',', '.')) : null
    if (timeToken && String(timeToken).includes(':')) {
      const [m, rest] = timeToken.split(':')
      const sec = Number(String(rest).replace(',', '.'))
      parsed.push({ name: cells[0], time: Number(m) * 60 + sec })
    } else {
      parsed.push({ name: cells[0], draw: cells[1], time })
    }
  }
  return parsed.filter((p) => p.time != null)
}

export function heatRows(entries, size = 5) {
  const heats = []
  for (let i = 0; i < entries.length; i += size) heats.push(entries.slice(i, i + size))
  return heats
}

export function showsAttended(entries, riderId) {
  return new Set(entries.filter((e) => e.riderId === riderId).map((e) => e.eventId)).size
}
