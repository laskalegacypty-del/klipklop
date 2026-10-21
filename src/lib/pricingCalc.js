import {
  ROLES,
  SEAT_PRICES,
  TIERS,
  MONTHS_FREE_ANNUAL,
  FEE_ROUNDING,
  LIMITS,
} from '../constants/pricing.js'

/**
 * Pure pricing functions. Every function takes `prices` so the same code
 * serves list prices and a client's proposed prices.
 */

const roleKeys = ROLES.map(r => r.key)

export function seatValue(tier, prices = SEAT_PRICES) {
  return roleKeys.reduce((sum, k) => sum + tier.seats[k] * prices[k], 0)
}

export function monthlyFee(tier, prices = SEAT_PRICES) {
  const discounted = seatValue(tier, prices) * (1 - tier.discount)
  return Math.round(discounted / FEE_ROUNDING) * FEE_ROUNDING
}

export function annualFee(tier, prices = SEAT_PRICES) {
  return monthlyFee(tier, prices) * (12 - MONTHS_FREE_ANNUAL)
}

export function effectiveSaving(tier, prices = SEAT_PRICES) {
  const full = seatValue(tier, prices)
  return full === 0 ? 0 : 1 - monthlyFee(tier, prices) / full
}

/** Seats above the tier allowance, per role. */
export function extraSeats(tier, counts) {
  const out = {}
  for (const k of roleKeys) out[k] = Math.max(0, (counts[k] || 0) - tier.seats[k])
  return out
}

export function costForTier(tier, counts, prices = SEAT_PRICES) {
  const extras = extraSeats(tier, counts)
  const extraCost = {}
  let extraTotal = 0
  for (const k of roleKeys) {
    extraCost[k] = extras[k] * prices[k]
    extraTotal += extraCost[k]
  }
  const fee = monthlyFee(tier, prices)
  return {
    tier: tier.name,
    tierFee: fee,
    extras,
    extraCost,
    extraTotal,
    totalMonthly: fee + extraTotal,
    // Extra seats stay on monthly billing even when the tier fee is prepaid.
    totalAnnualPrepay: annualFee(tier, prices) + extraTotal * 12,
  }
}

export function compareTiers(counts, prices = SEAT_PRICES) {
  return TIERS.map(t => costForTier(t, counts, prices))
}

/** Cheapest tier for these counts; ties go to the smaller tier. */
export function cheapestTier(counts, prices = SEAT_PRICES) {
  return compareTiers(counts, prices).reduce((best, c) => (c.totalMonthly < best.totalMonthly ? c : best))
}

/** The tier one step up from this one, or null when already on the largest. */
export function nextTierOf(tier) {
  const i = TIERS.findIndex(t => t.name === tier.name)
  return TIERS[i + 1] || null
}

export function formatRand(n) {
  const v = Math.round(Number(n) || 0)
  const sign = v < 0 ? '-' : ''
  return `${sign}R${Math.abs(v).toLocaleString('en-US')}`
}

export function formatPercent(n) {
  return `${Math.round((Number(n) || 0) * 100)}%`
}

/** Returns a clean whole-number counts object, or null when any value is invalid. */
export function sanitiseCounts(raw) {
  const out = {}
  for (const k of roleKeys) {
    const v = raw?.[k]
    if (v === '' || v === null || v === undefined) { out[k] = 0; continue }
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > LIMITS.maxSeatCount || !Number.isInteger(n)) return null
    out[k] = n
  }
  return out
}

/** Returns a clean prices object (up to cents), or null when any value is invalid. */
export function sanitisePrices(raw) {
  const out = {}
  for (const k of roleKeys) {
    const v = raw?.[k]
    if (v === '' || v === null || v === undefined || typeof v === 'boolean') return null
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > LIMITS.maxPricePerSeat) return null
    out[k] = Math.round(n * 100) / 100
  }
  return out
}
