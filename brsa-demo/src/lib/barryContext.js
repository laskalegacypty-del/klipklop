// Tiny rider snapshot for Barry when the demo is looking as a rider.

export function buildBarryRiderBlock({ rider, horses = [], unpaidFines = [], nextEvent }) {
  if (!rider) return ''
  const lines = [
    `Name: ${rider.name}`,
    `SA number: ${rider.sa || '—'}`,
    `Class: ${rider.class || '—'}`,
    `Province: ${rider.province || '—'}`,
    `Season points: ${rider.points ?? '—'}`,
    `Wallet: R${rider.wallet ?? '—'}`,
  ]
  if (rider.membershipNote) lines.push(`Membership: ${rider.membershipNote}`)
  if (unpaidFines.length) {
    lines.push(`Unpaid fines: ${unpaidFines.map((f) => `${f.label} (R${f.amount})`).join('; ')}`)
    lines.push('Unpaid fines block the next entry (Section A).')
  } else {
    lines.push('Unpaid fines: none')
  }
  const mine = horses.filter((h) => h.riderId === rider.id)
  if (mine.length) {
    lines.push(`Horses: ${mine.map((h) => h.name).join(', ')}`)
  }
  if (nextEvent) {
    lines.push(`Next / live show: ${nextEvent.name} (${nextEvent.date}) at ${nextEvent.venue}`)
  }
  return lines.join('\n')
}

const PERSONAL_KEYWORDS = [
  ' my ', ' mine ', ' i owe ', ' my horse', ' my season',
  ' my points', ' my fine', ' my wallet', ' can i enter',
]

export function looksPersonal(query) {
  const q = ` ${String(query || '').toLowerCase()} `
  return PERSONAL_KEYWORDS.some((k) => q.includes(k))
}
