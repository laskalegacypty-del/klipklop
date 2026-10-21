import { describe, it, expect } from 'vitest'
import { TIERS, SEAT_PRICES } from '../constants/pricing.js'
import {
  monthlyFee,
  annualFee,
  costForTier,
  compareTiers,
  cheapestTier,
  formatRand,
  nextTierOf,
  sanitiseCounts,
  sanitisePrices,
} from './pricingCalc.js'

const tier = name => TIERS.find(t => t.name === name)
const EXAMPLE = { rider: 40, supporter: 20, producer: 9, admin: 2 }

describe('list-price tier fees', () => {
  it('monthly fees', () => {
    const fees = Object.fromEntries(TIERS.map(t => [t.name, monthlyFee(t)]))
    expect(fees).toEqual({ Micro: 370, Starter: 560, Standard: 1040, Growth: 1920, Large: 3340 })
  })

  it('annual prepay fees (12 minus 2 months free)', () => {
    const fees = Object.fromEntries(TIERS.map(t => [t.name, annualFee(t)]))
    expect(fees).toEqual({ Micro: 3700, Starter: 5600, Standard: 10400, Growth: 19200, Large: 33400 })
  })
})

describe('calculator example: 40 riders, 20 supporters, 9 producers, 2 admins', () => {
  it('Starter costs R910 (R560 + 7 extra producers at R50)', () => {
    const c = costForTier(tier('Starter'), EXAMPLE)
    expect(c.tierFee).toBe(560)
    expect(c.extras).toEqual({ rider: 0, supporter: 0, producer: 7, admin: 0 })
    expect(c.extraTotal).toBe(350)
    expect(c.totalMonthly).toBe(910)
  })

  it('compares every tier and picks Starter as cheapest', () => {
    const totals = Object.fromEntries(compareTiers(EXAMPLE).map(c => [c.tier, c.totalMonthly]))
    expect(totals).toEqual({ Micro: 1090, Starter: 910, Standard: 1290, Growth: 1970, Large: 3340 })
    expect(cheapestTier(EXAMPLE).tier).toBe('Starter')
  })

  it('keeps extra seats on monthly billing in the annual view', () => {
    const c = costForTier(tier('Starter'), EXAMPLE)
    expect(c.totalAnnualPrepay).toBe(5600 + 350 * 12)
  })
})

describe('proposed prices', () => {
  it('rider price R8, others unchanged: Starter is R500', () => {
    const proposed = { ...SEAT_PRICES, rider: 8 }
    expect(monthlyFee(tier('Starter'), proposed)).toBe(500)
  })
})

describe('rounding to the nearest R10', () => {
  it('rounds the discounted seat value', () => {
    // Starter: 740 x 0.75 = 555 -> 560 ; Standard: 1480 x 0.7 = 1036 -> 1040 ; Large: 5570 x 0.6 = 3342 -> 3340
    expect(monthlyFee(tier('Starter'))).toBe(560)
    expect(monthlyFee(tier('Standard'))).toBe(1040)
    expect(monthlyFee(tier('Large'))).toBe(3340)
  })

  it('Growth rounds down: 2960 x 0.65 = 1924 -> 1920', () => {
    expect(monthlyFee(tier('Growth'))).toBe(1920)
  })
})

describe('sanitising', () => {
  it('rejects negative, non-numeric and absurd prices', () => {
    expect(sanitisePrices({ ...SEAT_PRICES, rider: -1 })).toBeNull()
    expect(sanitisePrices({ ...SEAT_PRICES, rider: 'abc' })).toBeNull()
    expect(sanitisePrices({ ...SEAT_PRICES, rider: 1e9 })).toBeNull()
    expect(sanitisePrices({ ...SEAT_PRICES, rider: NaN })).toBeNull()
    expect(sanitisePrices({ ...SEAT_PRICES, rider: true })).toBeNull()
  })

  it('accepts valid prices', () => {
    expect(sanitisePrices({ rider: '8', supporter: 2, producer: 50, admin: 100 })).toEqual({
      rider: 8, supporter: 2, producer: 50, admin: 100,
    })
  })

  it('rejects bad counts and treats blank as zero', () => {
    expect(sanitiseCounts({ rider: -3 })).toBeNull()
    expect(sanitiseCounts({ rider: 1.5 })).toBeNull()
    expect(sanitiseCounts({ rider: 1e9 })).toBeNull()
    expect(sanitiseCounts({ rider: '', supporter: '4' })).toEqual({ rider: 0, supporter: 4, producer: 0, admin: 0 })
  })
})

describe('formatRand', () => {
  it('formats as R1,234', () => {
    expect(formatRand(1234)).toBe('R1,234')
    expect(formatRand(910)).toBe('R910')
    expect(formatRand(33400)).toBe('R33,400')
  })
})

describe('nextTierOf', () => {
  it('returns the tier one step up, or null for the largest', () => {
    expect(nextTierOf(tier('Micro')).name).toBe('Starter')
    expect(nextTierOf(tier('Growth')).name).toBe('Large')
    expect(nextTierOf(tier('Large'))).toBeNull()
  })

  it('example: next tier after Starter is Standard at R1,290 (R380 more than Starter)', () => {
    const mine = costForTier(tier('Starter'), EXAMPLE)
    const next = costForTier(nextTierOf(tier('Starter')), EXAMPLE)
    expect(next.totalMonthly).toBe(1290)
    expect(next.totalMonthly - mine.totalMonthly).toBe(380)
  })
})
