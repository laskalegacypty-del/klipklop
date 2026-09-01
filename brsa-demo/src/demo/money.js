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

export function rand(n) {
  return `R${Number(n).toLocaleString('en-ZA')}`
}

export function entryFee(klass, carryOver) {
  return (CLASS_FEES[klass] ?? 350) + (carryOver ? CARRY_OVER_FEE : 0)
}

export function placePoints(place) {
  if (place >= 1 && place <= 5) return 6 - place
  return 0
}

export function pointsForResult(result, entry) {
  let pts = 5
  if (entry?.carryOver) pts += 5
  pts += placePoints(result.place)
  return pts
}
